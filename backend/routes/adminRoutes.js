// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const ProctoringLog = require('../models/ProctoringLog');

// Get all device logs
router.get('/device-logs', async (req, res) => {
  try {
    const logs = await ProctoringLog.find({ 
      eventType: { $in: ['DEVICE_LOG', 'LOGIN', 'DEVICE_CHECK'] }
    }).sort({ timestamp: -1 }).limit(100);
    
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get statistics
router.get('/statistics', async (req, res) => {
  try {
    const mobileLogins = await ProctoringLog.countDocuments({ 
      isPhone: true, 
      eventType: 'LOGIN' 
    });
    
    const desktopLogins = await ProctoringLog.countDocuments({ 
      isPhone: false, 
      eventType: 'LOGIN' 
    });
    
    res.json({
      success: true,
      statistics: {
        mobileLogins,
        desktopLogins,
        totalLogins: mobileLogins + desktopLogins
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;