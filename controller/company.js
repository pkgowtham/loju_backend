import company from "../model/company.js";
import Company from "../model/company.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { CustomError } from "../utils/errorHandler.js";
import { handleMultipartUpload, deleteS3FileByUrl } from "../utils/s3Upload.js";
import { validateCreateBody, validateUpdateBody } from "../utils/validation.js";

// 🏢 Create Company
export const create = asyncWrapper(async (req, res) => {
  const { dp, ...body } = await handleMultipartUpload(
    req,
    {
      maxFileSize: 20 * 1024 * 1024,
      maxFileCount: 1,
    },
    "company"
  );

  const { universityId } = req.auth?.details;
  if (!universityId) throw new CustomError("University ID missing", 400);

  body.universityId = universityId.toString();

  await validateCreateBody(Company, { ...body, dpUrl: dp[0] });

  if (!dp || !dp.length) {
    throw new CustomError("Company image is required", 400);
  }

  const company = await Company.create({ ...body, dpUrl: dp[0] });
  res.status(201).json({ success: true, data: company });
});

// 📝 Update Company
export const update = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const company = await Company.findById(id);
  if (!company) throw new CustomError("Company not found", 404);

  const { dp, ...body } = await handleMultipartUpload(
    req,
    {
      maxFileSize: 20 * 1024 * 1024,
      maxFileCount: 1,
    },
    "company"
  );

  if (dp && dp.length) {
    if (company.dpUrl) await deleteS3FileByUrl([company.dpUrl]);
    body.dpUrl = dp[0];
  }

  await validateUpdateBody(Company, body);
  const updated = await Company.findByIdAndUpdate(id, body, { new: true });
  res.status(200).json({ success: true, data: updated });
});

// 🧾 Get Company List with Filters
export const getList = asyncWrapper(async (req, res) => {
  const { category, search, page = 1, limit = 10 } = req.query;

  const query = {};
  if (category) query.category = category.toUpperCase();
  if (search) query.name = { $regex: search, $options: "i" };

  const count = await Company.countDocuments(query);

  const companies = await Company.find(query)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .sort({ createdAt: -1 });

  res
    .status(200)
    .json({
      success: true,
      total: count,
      page: page,
      pageSize: limit,
      data: companies,
    });
});


// 🎯 Get Companies by University (Maintainer only)
export const getByUniversityId = asyncWrapper(async (req, res) => {
  const { category, search, page = 1, limit = 10 } = req.query;

    
  if (req.auth.role !== "MAINTAINER") {
    throw new CustomError("Only maintainers can access this", 403);
  }
  

  const {universityId} = req.auth?.details;
  if (!universityId) throw new CustomError("University ID not found", 400);

  const query = {};
  if(universityId) query.universityId = universityId;
  if (category) query.category = category.toUpperCase();
  if (search) query.name = { $regex: search, $options: "i" };

  const count = await Company.countDocuments(query);

  const companies = await Company.find(query)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .sort({ createdAt: -1 });

  res
    .status(200)
    .json({
      success: true,
      total: count,
      page: page,
      pageSize: limit,
      data: companies,
    });
});

// ❌ Delete Company
export const destroy = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const company = await Company.findById(id);
  if (!company) throw new CustomError("Company not found", 404);

  if (company.dpUrl) await deleteS3FileByUrl([company.dpUrl]);
  await company.deleteOne();

  res.status(200).json({ success: true, message: "Company deleted" });
});
