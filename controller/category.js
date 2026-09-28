import Category from "../model/category.js";
import Subcategory from "../model/subcategory.js";
import Society from "../model/society.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { CustomError } from "../utils/errorHandler.js";
import { handleMultipartUpload, deleteS3FileByUrl } from "../utils/s3Upload.js";
import { validateCreateBody, validateUpdateBody } from "../utils/validation.js";
import University from "../model/university.js";
import { parse } from "csv-parse/sync";
import fetch from "node-fetch";

export const create = asyncWrapper(async (req, res) => {
  const data = await handleMultipartUpload(
    req,
    { maxFileSize: 20 * 1024 * 1024, maxFileCount: 1 },
    "category"
    
  );

  if (!data.icon || !Array.isArray(data.icon) || !data.icon[0]) {
    throw new CustomError("Icon is required", 400);
  }

  await validateCreateBody(Category, { ...data, icon: data.icon[0] });
  const category = await Category.create({ ...data, icon: data.icon[0] });

  res.status(201).json({ success: true, data: category });
});

export const createFromCSV = async (req, res, next) => {
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

    const fileUrl = data.file[0];
    const response = await fetch(fileUrl);
    if (!response.ok) {
      return next(new CustomError("Failed to fetch CSV from storage", 500));
    }

    const csvData = await response.text();

    const records = parse(csvData, {
      columns: ["categoryName", "categoryType", "categoryIcon", "display"],
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

    for (const [index, record] of records.entries()) {
      try {
        if (
          !record.categoryName?.trim() ||
          !record.categoryType?.trim() ||
          !record.categoryIcon?.trim()
        ) {
          throw new CustomError(
            `Missing required fields at row ${index + 2}`,
            400
          );
        }

        // 🔹 Check if category exists
        let category = await Category.findOne({
          name: record.categoryName.trim(),
          type: record.categoryType.trim(),
        });

        if (!category) {
          // 🔹 Create new category
          await Category.create({
            name: record.categoryName.trim(),
            type: record.categoryType.trim(),
            icon: record.categoryIcon.trim(),
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

    res.status(200).json({
      message: "CSV processed successfully (Categories only)",
      processedCount,
      totalRecords: records.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    console.error("CSV processing failed:", error);
    next(new CustomError(`Failed to process CSV: ${error.message}`, 500));
  }
};

export const update = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const existing = await Category.findById(id);
  if (!existing) throw new CustomError("Category not found", 404);

  const data = await handleMultipartUpload(
    req,
    { maxFileSize: 3 * 1024 * 1024, maxFileCount: 1 },
    "category"
  );

  // If icon updated, delete old image from S3
  if (data.icon && Array.isArray(data.icon) && data.icon[0]) {
    if (existing.icon) await deleteS3FileByUrl([existing.icon]);
    data.icon = data.icon[0];
  } else {
    delete data.icon;
  }

  await validateUpdateBody(Category, { ...data });

  Object.assign(existing, data);
  await existing.save();

  res.status(200).json({ success: true, data: existing });
});

export const getList = asyncWrapper(async (req, res) => {
  const { search = "", type, display, page = 1, limit = 10 } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  const searchRegex = new RegExp(search, "i");

  const query = {};

  if (search) query.name = { $regex: searchRegex };
  if (type) query.type = type;
  if (display === "true") query.display = true;
  if (display === "false") query.display = false;

  const total = await Category.countDocuments(query);

  const categories = await Category.find(query)
    .sort({ name: 1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const categoryIds = categories.map((c) => c._id);

  const subcategories = await Subcategory.find({
    categoryId: { $in: categoryIds },
  }).lean();

  const categoryMap = {};
  subcategories.forEach((sub) => {
    const id = sub.categoryId.toString();
    if (!categoryMap[id]) categoryMap[id] = [];
    categoryMap[id].push(sub);
  });

  const result = categories.map((cat) => ({
    ...cat,
    subcategories: categoryMap[cat._id.toString()] || [],
  }));

  res.status(200).json({
    success: true,
    total,
    page: Number(page),
    pageSize: result.length,
    data: result,
  });
});

export const destroy = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { newCategoryId, newSubcategoryId } = req.body;

  const category = await Category.findById(id);
  if (!category) throw new CustomError("Category not found", 404);

  // 🔍 Check if any societies are associated with this category
  const societies = await Society.find({ categoryId: id });

  if (societies.length > 0) {
    // 🔐 Require reassignment only if societies exist
    if (!newCategoryId || !newSubcategoryId) {
      throw new CustomError(
        "Reassignment required: Provide newCategoryId and newSubcategoryId",
        400
      );
    }

    // 🔄 Reassign societies
    await Society.updateMany(
      { category: id },
      {
        $set: {
          category: newCategoryId,
          subcategory: newSubcategoryId,
        },
      }
    );
  }

  // 🧹 Delete all subcategories under this category
  await Subcategory.deleteMany({ category: id });

  // 🧼 Remove icon from S3 if exists
  if (category.iconUrl) {
    await deleteS3FileByUrl([category.iconUrl]);
  }

  // 🗑️ Finally delete the category
  await category.deleteOne();

  res.status(200).json({
    success: true,
    message: societies.length
      ? "Category deleted, subcategories removed, and societies reassigned"
      : "Category and its subcategories deleted",
  });
});
