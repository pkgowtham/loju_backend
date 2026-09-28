 import { Router } from 'express';
import { sendEventReminders, setupEventReminderCronJob  } from '../utils/reminderEvent.js';

const router = Router();

// Only enable in development
if (process.env.NODE_ENV === 'development') {
    router.post('/', async (req, res) => {
        console.log('Test reminder endpoint accessed'); // Debug log
        try {
            await sendEventReminders();
            res.json({ 
                success: true, 
                message: 'Reminder job triggered manually',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error in test reminder:', error);
            res.status(500).json({ 
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });
}

export default router; 
