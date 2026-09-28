import University from "../model/university.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { CustomError } from "../utils/errorHandler.js";
import { validateCreateBody, validateUpdateBody } from "../utils/validation.js";
import { handleMultipartUpload, deleteS3FileByUrl } from "../utils/s3Upload.js";
import Maintainer from "../model/maintainer.js";
import { hashPassword } from "../utils/hash.js";
import User from "../model/user.js";
export const getList = asyncWrapper(async (req, res) => {
  const { search = "", page = 1, limit = 10 } = req.query;

  const searchRegex = new RegExp(search, "i");
  const query = {};

  if (search) {
    query.name = { $regex: searchRegex };
  }

  const universities = await University.find(query)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .sort({ createdAt: -1 });

  const total = await University.countDocuments(query);

  res.status(200).json({
    success: true,
    data: universities,
    page: Number(page),
    limit: Number(limit),
    total,
  });
});

// export const create = asyncWrapper(async (req, res) => {
//   const data = await handleMultipartUpload(req, {
//     maxFileSize: 20 * 1024 * 1024,
//     maxFileCount: 1,
//   });

//   await validateCreateBody(University, data);
//   const university = await University.create(data);
//   res.status(201).json({ success: true, data: university });
// });

export const create = asyncWrapper(async (req, res) => {
  const data = await handleMultipartUpload(
    req,
    {
      maxFileSize: 20 * 1024 * 1024,
      maxFileCount: 1,
    },
    "university"
  );

  await validateCreateBody(University, data);

  // Step 3: Parse and validate maintainers BEFORE any create
  let maintainersData = [];

  if (data.maintainers) {
    if (typeof data.maintainers === "string") {
      try {
        maintainersData = JSON.parse(data.maintainers);
      } catch (err) {
        throw new CustomError("Invalid JSON format for maintainers", 400);
      }
    } else if (Array.isArray(data.maintainers)) {
      maintainersData = data.maintainers;
    }
  }

  // Step 4: Validate maintainers (if any)
  if (maintainersData.length > 0) {
    const invalidMaintainers = maintainersData.filter(
      (m) => !m.firstName || !m.lastName || !m.email || !m.password
    );

    if (invalidMaintainers.length > 0) {
      throw new CustomError(
        "Each maintainer must include firstName, lastName, email, and password",
        400
      );
    }
  }

  const university = await University.create(data);

  const maintainerDocs = [];
  const userDocs = [];

  for (const m of maintainersData) {
    const newMaintainer = await Maintainer.create({
      firstName: m.firstName,
      lastName: m.lastName,
      universityId: university._id,
      active: m.active ?? true,
    });

    const hashedPassword = await hashPassword(m.password);

    userDocs.push({
      email: m.email,
      password: hashedPassword,
      role: "MAINTAINER",
      details: newMaintainer._id,
      detailsModel: "Maintainer",
    });

    maintainerDocs.push(newMaintainer.toObject());
  }

  if (userDocs.length > 0) {
    await User.insertMany(userDocs);
  }

  return res.status(201).json({
    success: true,
    data: {
      university,
      maintainers: maintainerDocs,
      message: maintainerDocs.length
        ? "University created with maintainers"
        : "University created",
    },
  });
});

export const update = asyncWrapper(async (req, res) => {
  const { id } = req.params;

  const university = await University.findById(id);
  if (!university) {
    throw new CustomError("University not found", 404);
  }

  const constraints = { maxFileSize: 20 * 1024 * 1024, maxFileCount: 1 };
  const updatedData = await handleMultipartUpload(
    req,
    constraints,
    "university"
  );

  await validateUpdateBody(University, updatedData);

  if (updatedData.logo) {
    const oldLogos = Array.isArray(university.logo)
      ? university.logo
      : [university.logo];
    const newLogos = Array.isArray(updatedData.logo)
      ? updatedData.logo
      : [updatedData.logo];

    await deleteS3FileByUrl(oldLogos);

    updatedData.logo = newLogos;
  }

  const updated = await University.findByIdAndUpdate(id, updatedData, {
    new: true,
  });

  res.status(200).json({
    success: true,
    data: updated,
  });
});

export const destroy = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const deleted = await University.findByIdAndDelete(id);
  if (!deleted) throw new CustomError("University not found", 404);
  res.status(200).json({ success: true, message: "University deleted" });
});
