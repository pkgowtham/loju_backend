import express from 'express'
import * as controller from "../controller/admin.js"
import { authenticate, authorizeRole } from '../middleware/authentication.js';


const router = express.Router()

router.get('/',authenticate,authorizeRole("ADMIN"),controller.getList)
router.post('/',authenticate,authorizeRole("ADMIN"),controller.create)
router.patch('/:id',authenticate,authorizeRole("ADMIN"),controller.update)
router.delete('/:id',authenticate,authorizeRole("ADMIN"),controller.destroy)

export default router;