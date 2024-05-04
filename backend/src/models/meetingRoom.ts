import mongoose from 'mongoose';
import { ReservationType, MeetingRoomType } from '../shared/types';
//models
const reservationSchema = new mongoose.Schema<ReservationType>({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  adultCount: { type: Number, required: true },
  // childCount: { type: Number, required: false },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  userId: { type: String, required: true },
  totalCost: { type: Number, required: true },
});

const meetingRoomSchema = new mongoose.Schema<MeetingRoomType>({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  city: { type: String, required: true },
  country: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, required: true },
  adultCount: { type: Number, required: true },
  // childCount: { type: Number, required: false },
  facilities: [{ type: String, required: true }],
  pricePerNight: { type: Number, required: true },
  starRating: { type: Number, required: true, min: 1, max: 5 },
  imageUrls: [{ type: String, required: true }],
  lastUpdated: { type: Date, required: true },
  bookings: [reservationSchema],
});

const MeetingRoom = mongoose.model<MeetingRoomType>(
  'MeetingRoom',
  meetingRoomSchema
);
export default MeetingRoom;
