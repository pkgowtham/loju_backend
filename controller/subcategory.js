import Subcategory from "../model/subcategory.js";
import Society from "../model/society.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { CustomError } from "../utils/errorHandler.js";
import { validateCreateBody, validateUpdateBody } from "../utils/validation.js";
import Category from "../model/category.js";
import StudentWithSubcategory from "../model/studentWithSubcategory.js";
import { parse } from "csv-parse/sync";
import fetch from "node-fetch";
import { handleMultipartUpload } from "../utils/s3Upload.js";

// ✅ Create Subcategory with category-type check
export const create = asyncWrapper(async (req, res) => {
  const body = req.body;

  // 🌈 Validate body
  await validateCreateBody(Subcategory, body);

  const category = await Category.findById(body.categoryId);
  if (!category) throw new CustomError("Category not found", 404);

  // 🧠 Check type match
  if (category.type !== body.type) {
    throw new CustomError(
      `Type mismatch: Category is of type '${category.type}'`,
      400
    );
  }

  const subcategory = await Subcategory.create(body);

  res.status(201).json({
    success: true,
    message: "Subcategory created successfully",
    data: subcategory,
  });
});

// csv upload SubCategory
export const createSubcategoriesFromCSV = async (req, res, next) => {
  try {
    // 1️⃣ Upload CSV
    const data = await handleMultipartUpload(
      req,
      { maxFileSize: 20 * 1024 * 1024, maxFileCount: 1 },
      "csv-upload"
    );

    if (!data.file?.[0]) {
      return next(new CustomError("No CSV file uploaded", 400, "File Error"));
    }

    // 2️⃣ Fetch CSV from S3 (or storage)
    const fileUrl = data.file[0];
    const response = await fetch(fileUrl);
    if (!response.ok) {
      return next(new CustomError("Failed to fetch CSV from storage", 500));
    }

    const csvData = await response.text();

    // 3️⃣ Parse CSV
    const records = parse(csvData, {
      columns: [
        "subcategoryName",
        "subcategoryType",
        "categoryName",
        "display",
      ],
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
      from_line: 2, // skip header row
    });

    if (!records.length) {
      return next(new CustomError("CSV is empty or invalid", 400));
    }

    const errors = [];
    let processedCount = 0;

    // 4️⃣ Process each row
    for (const [index, record] of records.entries()) {
      try {
        if (
          !record.subcategoryName?.trim() ||
          !record.subcategoryType?.trim() ||
          !record.categoryName?.trim()
        ) {
          throw new CustomError(
            `Missing required fields at row ${index + 2}`,
            400
          );
        }

        // 🔹 Find parent category
        const category = await Category.findOne({
          name: record.categoryName.trim(),
        });

        if (!category) {
          throw new CustomError(
            `Category "${record.categoryName}" not found (row ${index + 2})`,
            400
          );
        }

        // 🔹 Check if subcategory exists
        let subcategory = await Subcategory.findOne({
          name: record.subcategoryName.trim(),
          categoryId: category._id,
        });

        if (!subcategory) {
          await Subcategory.create({
            name: record.subcategoryName.trim(),
            type: record.subcategoryType.trim(),
            categoryId: category._id,
            display:
              record.display === undefined || record.display === ""
                ? true
                : record.display.toLowerCase() === "true",
          });

          processedCount++;
        }
      } catch (err) {
        errors.push({ row: index + 2, error: err.message });
      }
    }

    // 5️⃣ Send response
    res.status(200).json({
      message: "CSV processed successfully (Subcategories only)",
      processedCount,
      totalRecords: records.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    console.error("CSV processing failed:", error);
    next(new CustomError(`Failed to process CSV: ${error.message}`, 500));
  }
};

// ✏️ Update Subcategory
export const update = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const subcategory = await Subcategory.findById(id);
  if (!subcategory) throw new CustomError("Subcategory not found", 404);

  await validateUpdateBody(Subcategory, req.body);
  Object.assign(subcategory, req.body);
  await subcategory.save();

  res.status(200).json({ success: true, data: subcategory });
});

// 🗑️ Delete Subcategory with Reassignment
export const destroy = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { newSubcategoryId } = req.body;
  const subcategory = await Subcategory.findById(id);
  if (!subcategory) throw new CustomError("Subcategory not found", 404);

  // 🔍 Check if subcategory is used in society or studentWithSubcategory
  const societyUsage = await Society.countDocuments({ subcategory: id });
  const studentUsage = await StudentWithSubcategory.countDocuments({
    subcategoryId: id,
  });

  if (Number(societyUsage) > 0 || Number(studentUsage) > 0) {
    if (!newSubcategoryId) {
      throw new CustomError(
        "Subcategory is in use. Provide 'newSubcategoryId' for reassignment.",
        400
      );
    }
    // 🔁 Reassign if needed
    const replacement = await Subcategory.findById(newSubcategoryId);
    if (!replacement) throw new CustomError("New subcategory not found", 404);

    await Society.updateMany(
      { subcategory: id },
      { subcategory: newSubcategoryId }
    );
    await StudentWithSubcategory.updateMany(
      { subcategoryId: id },
      { subcategoryId: newSubcategoryId }
    );
  }

  await subcategory.deleteOne();

  res.status(200).json({
    success: true,
    message: "Subcategory deleted successfully",
  });
});

// 📄 Get Subcategory List with Filters
export const getList = asyncWrapper(async (req, res) => {
  const {
    search = "",
    categoryId,
    type,
    display,
    page = 1,
    limit = 10,
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  const query = { name: new RegExp(search, "i") };

  if (categoryId) query.categoryId = categoryId;
  if (type) query.type = type;
  if (display !== undefined) query.display = display === "true";

  const subcategories = await Subcategory.find(query)
    .populate("categoryId")
    .sort({ name: 1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Subcategory.countDocuments(query);

  res.status(200).json({
    success: true,
    total,
    page: Number(page),
    pageSize: subcategories.length,
    data: subcategories,
  });
});
