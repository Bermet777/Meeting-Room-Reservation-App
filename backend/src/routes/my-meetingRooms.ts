import express, { Request, Response } from 'express';
import multer from 'multer';
import cloudinary from 'cloudinary';
import MeetingRoom from '../models/meetingRoom';
import verifyToken from '../middleware/auth';
import { body } from 'express-validator';
import { MeetingRoomType } from '../shared/types';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

router.post(
  '/',
  verifyToken,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('city').notEmpty().withMessage('City is required'),
    body('country').notEmpty().withMessage('Country is required'),
    body('description')
      .notEmpty()
      .withMessage('Description is required'),
    body('type').notEmpty().withMessage('Meeting Room type is required'),
    body('pricePerNight')
      .notEmpty()
      .isNumeric()
      .withMessage(
        'Price per day is required and must be a number'
      ),
    body('facilities')
      .notEmpty()
      .isArray()
      .withMessage('Facilities are required'),
  ],
  upload.array('imageFiles', 6),
  async (req: Request, res: Response) => {
    try {
      const imageFiles = req.files as Express.Multer.File[];
      const newMeetingRoom: MeetingRoomType = req.body;

      const imageUrls = await uploadImages(imageFiles);

      newMeetingRoom.imageUrls = imageUrls;
      newMeetingRoom.lastUpdated = new Date();
      newMeetingRoom.userId = req.userId;

      const meetingRoom = new MeetingRoom(newMeetingRoom);
      await meetingRoom.save();

      res.status(201).send(meetingRoom);
    } catch (e) {
      console.log(e);
      res.status(500).json({ message: 'Something went wrong' });
    }
  }
);

router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const meetingRooms = await MeetingRoom.find({ userId: req.userId });
    res.json(meetingRooms);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching meeting Rooms' });
  }
});

router.get(
  '/:id',
  verifyToken,
  async (req: Request, res: Response) => {
    const id = req.params.id.toString();
    try {
      const meetingRoom = await MeetingRoom.findOne({
        _id: id,
        userId: req.userId,
      });
      res.json(meetingRoom);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching meeting rooms' });
    }
  }
);

router.put(
  '/:meetingRoomId',
  verifyToken,
  upload.array('imageFiles'),
  async (req: Request, res: Response) => {
    try {
      const updatedMeetingRoom: MeetingRoomType = req.body;
      updatedMeetingRoom.lastUpdated = new Date();

      const meetingRoom = await MeetingRoom.findOneAndUpdate(
        {
          _id: req.params.meetingRoomId,
          userId: req.userId,
        },
        updatedMeetingRoom,
        { new: true }
      );

      if (!meetingRoom) {
        return res.status(404).json({ message: 'Meeting Room not found' });
      }

      const files = req.files as Express.Multer.File[];
      const updatedImageUrls = await uploadImages(files);

      meetingRoom.imageUrls = [
        ...updatedImageUrls,
        ...(updatedMeetingRoom.imageUrls || []),
      ];

      await meetingRoom.save();
      res.status(201).json(meetingRoom);
    } catch (error) {
      res.status(500).json({ message: 'Something went wrong' });
    }
  }
);

async function uploadImages(imageFiles: Express.Multer.File[]) {
  const uploadPromises = imageFiles.map(async (image) => {
    const b64 = Buffer.from(image.buffer).toString('base64');
    let dataURI = 'data:' + image.mimetype + ';base64,' + b64;
    const res = await cloudinary.v2.uploader.upload(dataURI);
    return res.url;
  });

  const imageUrls = await Promise.all(uploadPromises);
  return imageUrls;
}

export default router;
