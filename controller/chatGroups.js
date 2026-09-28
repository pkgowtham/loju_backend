import ChatGroups from "../model/chatGroups.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { CustomError } from "../utils/errorHandler.js";

// ✅ 1. getAllChatGroups   student linked chatGroups List
export const getAllChatGroups = asyncWrapper(async (req, res) => {
    const { studentsId } = req.params

    if (!studentsId) {
        throw new CustomError("studentId is required", 400);
    }

    const chatGroups = await ChatGroups.find({ studentsId })
        .populate("societyId", "name") // populate society name
        .populate("studentsId", "fullName dp avatarDisplay avatar  avatarBg isBlocked"); // populate student details

    res.status(200).json({
        success: true,
        count: chatGroups.length,
        data: chatGroups,
    });
});

export const reportChat = asyncWrapper(async(req,res)=>{
    const { studentId, chatGroupsId, reason,note } = req.body;
    const report = await Report.create({ studentId, chatGroupsId, reason,note,type:"CHAT" });
    res.status(200).json({
        success: true,
        message:"Successfully reported the chat",
    });
})