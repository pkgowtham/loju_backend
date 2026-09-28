import { asyncWrapper } from "../utils/asyncWrapper.js";

export const getList = asyncWrapper(async (req, res) => {
  res.status(200).json({
    success: true,
  });
});
