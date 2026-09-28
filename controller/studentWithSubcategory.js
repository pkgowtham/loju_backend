import StudentWithSubcategory from "../model/studentWithSubcategory.js";
import Subcategory from "../model/subcategory.js";
import Category from "../model/category.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { CustomError } from "../utils/errorHandler.js";

export const create = asyncWrapper(async (req, res) => {
  const { studentId, subcategoryIds } = req.body;
  if (!studentId || !Array.isArray(subcategoryIds)) {
    throw new CustomError("studentId and subcategoryIds array are required", 400);
  }

  const created = [];
  for (const subId of subcategoryIds) {
    const exists = await StudentWithSubcategory.findOne({ studentId, subcategoryId: subId });
    if (exists) throw new CustomError(`Student already interested in subcategory ${subId}`, 400);
    const doc = await StudentWithSubcategory.create({ studentId, subcategoryId: subId });
    created.push(doc);
  }

  res.status(201).json({ success: true, data: created });
});


export const getList = asyncWrapper(async (req, res) => {
  const { studentId } = req.params;
  if (!studentId) throw new CustomError("studentId is required", 400);

  const interests = await StudentWithSubcategory.find({ studentId }).populate({
    path: "subcategoryId",
    populate: { path: "categoryId" },
  });

  const categoryMap = new Map();

  for (const item of interests) {
    const subcategory = item.subcategoryId;
    const category = subcategory?.categoryId;

    if (!category || !subcategory) continue;

    const categoryId = category._id.toString();

    if (!categoryMap.has(categoryId)) {
      // 🌟 First time seeing this category
      categoryMap.set(categoryId, {
        _id: category._id,
        name: category.name,
        type: category.type,
        iconUrl: category.iconUrl,
        display: category.display,
        subcategories: [],
      });
    }

    categoryMap.get(categoryId).subcategories.push({
      _id: subcategory._id,
      name: subcategory.name,
      type: subcategory.type,
      display: subcategory.display,
    });
  }

  const data = Array.from(categoryMap.values());

  res.status(200).json({
    success: true,
    data,
  });
});

export const destroy = asyncWrapper(async (req, res) => {
  const { studentId } = req.params;
  const { subcategoryId } = req.body;
  if (!studentId || !subcategoryId) {
    throw new CustomError("studentId and subcategoryId are required", 400);
  }

  const result = await StudentWithSubcategory.findOneAndDelete({
    studentId,
    subcategoryId,
  });
  if (!result) throw new CustomError("Interest not found", 404);

  res.status(200).json({ success: true, message: "Interest deleted" });
});
