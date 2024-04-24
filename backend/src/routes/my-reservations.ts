import express, { Request, Response } from 'express';
import verifyToken from '../middleware/auth';
import MeetingRoom from '../models/meetingRoom';
import { MeetingRoomType } from '../shared/types';

const router = express.Router();

// /api/my-bookings
router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const meetingRooms = await MeetingRoom.find({
      bookings: { $elemMatch: { userId: req.userId } },
    });

    const results = meetingRooms.map((meetingRoom) => {
      const userBookings = meetingRoom.bookings.filter(
        (booking) => booking.userId === req.userId
      );

      const meetingRoomWithUserReservations: MeetingRoomType = {
        ...meetingRoom.toObject(),
        bookings: userBookings,
      };

      return meetingRoomWithUserReservations;
    });

    res.status(200).send(results);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Unable to fetch reservations' });
  }
});

export default router;
