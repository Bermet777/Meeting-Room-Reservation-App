import express, { Request, Response } from 'express';
import MeetingRoom from '../models/meetingRoom';
import {
  ReservationType,
  MeetingRoomSearchResponse,
} from '../shared/types';
import { param, validationResult } from 'express-validator';
import Stripe from 'stripe';
import verifyToken from '../middleware/auth';

const stripe = new Stripe(process.env.STRIPE_API_KEY as string);

const router = express.Router();

router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = constructSearchQuery(req.query);

    let sortOptions = {};
    switch (req.query.sortOption) {
      case 'starRating':
        sortOptions = { starRating: -1 };
        break;
      case 'pricePerNightAsc':
        sortOptions = { pricePerNight: 1 };
        break;
      case 'pricePerNightDesc':
        sortOptions = { pricePerNight: -1 };
        break;
    }

    const pageSize = 5;
    const pageNumber = parseInt(
      req.query.page ? req.query.page.toString() : '1'
    );
    const skip = (pageNumber - 1) * pageSize;

    const meetingRooms = await MeetingRoom.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(pageSize);

    const total = await MeetingRoom.countDocuments(query);

    const response: MeetingRoomSearchResponse = {
      data: meetingRooms,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / pageSize),
      },
    };

    res.json(response);
  } catch (error) {
    console.log('error', error);
    res.status(500).json({ message: 'Something went wrong' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const meetingRooms = await MeetingRoom.find().sort('-lastUpdated');
    res.json(meetingRooms);
  } catch (error) {
    console.log('error', error);
    res.status(500).json({ message: 'Error fetching meeting rooms' });
  }
});

router.get(
  '/:id',
  [param('id').notEmpty().withMessage('Meeting Room ID is required')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const id = req.params.id.toString();

    try {
      const meetingRooms = await MeetingRoom.findById(id);
      res.json(meetingRooms);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error fetching meeting room' });
    }
  }
);

router.post(
  '/:meetingRoomId/bookings/payment-intent',
  verifyToken,
  async (req: Request, res: Response) => {
    const { numberOfNights } = req.body;
    const meetingRoomId = req.params.meetingRoomId;

    const meetingRoom = await MeetingRoom.findById(meetingRoomId);
    if (!meetingRoom) {
      return res.status(400).json({ message: 'Meeting Room not found' });
    }

    const totalCost = meetingRoom.pricePerNight * numberOfNights;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCost * 100,
      currency: 'usd',
      metadata: {
        meetingRoomId: meetingRoomId,
        userId: req.userId,
      },
    });

    if (!paymentIntent.client_secret) {
      return res
        .status(500)
        .json({ message: 'Error creating payment intent' });
    }

    const response = {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret.toString(),
      totalCost,
    };

    res.send(response);
  }
);

router.post(
  '/:meetingRoomId/bookings',
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const paymentIntentId = req.body.paymentIntentId;

      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId as string
      );

      if (!paymentIntent) {
        return res
          .status(400)
          .json({ message: 'payment intent not found' });
      }

      if (
        paymentIntent.metadata.meetingRoomId !== req.params.meetingRoomId ||
        paymentIntent.metadata.userId !== req.userId
      ) {
        return res
          .status(400)
          .json({ message: 'payment intent mismatch' });
      }

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          message: `payment intent not succeeded. Status: ${paymentIntent.status}`,
        });
      }

      const newBooking: ReservationType = {
        ...req.body,
        userId: req.userId,
      };

      const meetingRoom = await MeetingRoom.findOneAndUpdate(
        { _id: req.params.meetingRoomId },
        {
          $push: { bookings: newBooking },
        }
      );

      if (!meetingRoom) {
        return res.status(400).json({ message: 'meeting room not found' });
      }

      await meetingRoom.save();
      res.status(200).send();
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'something went wrong' });
    }
  }
);

const constructSearchQuery = (queryParams: any) => {
  let constructedQuery: any = {};

  if (queryParams.destination) {
    constructedQuery.$or = [
      { city: new RegExp(queryParams.destination, 'i') },
      { country: new RegExp(queryParams.destination, 'i') },
    ];
  }

  if (queryParams.adultCount) {
    constructedQuery.adultCount = {
      $gte: parseInt(queryParams.adultCount),
    };
  }

  // if (queryParams.childCount) {
  //   constructedQuery.childCount = {
  //     $gte: parseInt(queryParams.childCount),
  //   };
  // }

  if (queryParams.facilities) {
    constructedQuery.facilities = {
      $all: Array.isArray(queryParams.facilities)
        ? queryParams.facilities
        : [queryParams.facilities],
    };
  }

  if (queryParams.types) {
    constructedQuery.type = {
      $in: Array.isArray(queryParams.types)
        ? queryParams.types
        : [queryParams.types],
    };
  }

  if (queryParams.stars) {
    const starRatings = Array.isArray(queryParams.stars)
      ? queryParams.stars.map((star: string) => parseInt(star))
      : parseInt(queryParams.stars);

    constructedQuery.starRating = { $in: starRatings };
  }

  if (queryParams.maxPrice) {
    constructedQuery.pricePerNight = {
      $lte: parseInt(queryParams.maxPrice).toString(),
    };
  }

  return constructedQuery;
};

export default router;
