import { Water } from "../models/water.js";
import { User } from "../models/user.js";
import HttpError from "../helpers/HttpError.js";

import ctrlWrapper from "../decorators/ctrlWrapper.js";
import { getDaysOfMonth } from "../helpers/waterHelper.js";

const addWater = async (req, res) => {
  const { _id: owner, dailyNorma: userDailyNorma } = req.user;

  const { date, waterDose } = req.body;

  const actualDate = date.toString().substring(0, 10);

  const toDayWaterData = await Water.findOne({ owner, date: actualDate });

  if (!toDayWaterData) {
    const data = {
      createdDate: date,
      waterDose,
    };

    const waterRate = Math.round((waterDose / userDailyNorma) * 100);

    const result = await Water.create({
      owner,
      date: actualDate,
      waterTotal: waterDose,
      persantRate: waterRate,
      dailyNorma: userDailyNorma,
      waterSavings: 1,
      waterNotes: [data],
      lastWaterDose: data,
    });

    res.status(201).json(result);
  } else {
    const { _id: id, waterTotal, waterSavings } = toDayWaterData;

    const updatedData = await Water.findOneAndUpdate(
      { _id: id },
      {
        $push: { waterNotes: { createdDate: date, waterDose } },
        $inc: { waterTotal: +waterDose, waterSavings: 1 },
        $set: {
          persantRate: Math.round(
            ((waterTotal + waterDose) / userDailyNorma) * 100
          ),
        },
      },
      { new: true }
    );

    const result = updatedData.toObject();
    result.lastWaterDose = result.waterNotes[result.waterNotes.length - 1];
    res.status(200).json(result);
  }
};

const today = async (req, res) => {
  const { date } = req.query;
  const { _id: owner, dailyNorma: userDailyNorma } = req.user;

  const actualDate = new Date(date).toISOString().substring(0, 10);

  const result = await Water.findOne({ date: actualDate, owner });
  if (!result) {
    const result = await Water.create({
      owner,
      date: actualDate,
      waterTotal: 0,
      persantRate: 0,
      dailyNorma: userDailyNorma,
      waterSavings: 0,
      waterNotes: [],
    });

    return res.status(201).json(result);
  }

  res.json(result);
};

const deleteWaterRecord = async (req, res) => {
  const { id } = req.params;
  const { _id: owner, dailyNorma: userDailyNorma } = req.user;

  let toDayWaterData = await Water.findOne({
    owner,
    "waterNotes._id": id,
  });
  if (!toDayWaterData) {
    throw HttpError(404, "Not Found");
  }

  let waterRecord = toDayWaterData.waterNotes.find(
    (option) => option.id === id
  );

  const { waterTotal } = toDayWaterData;

  let deletedWaterDose = waterRecord.waterDose;
  toDayWaterData = await Water.findOneAndUpdate(
    { owner, "waterNotes._id": id },

    {
      $inc: { waterTotal: -deletedWaterDose, waterSavings: -1 },
      $pull: { waterNotes: { _id: id } },
      $set: {
        persantRate: Math.round(
          ((waterTotal - deletedWaterDose) / userDailyNorma) * 100
        ),
      },
    },
    { new: true }
  );

  const response = {
    message: "Delete success",
    id,
    waterTotal: toDayWaterData.waterTotal,
    persantRate: toDayWaterData.persantRate,
    waterSavings: toDayWaterData.waterSavings,
  };

  return res.json(response);
};

const updateWaterDose = async (req, res) => {
  const { id } = req.params;
  const { _id: owner, dailyNorma: userDailyNorma } = req.user;
  const { waterDose: newWaterDose, createdDate: newCreatedDate } = req.body;

  let toDayWaterData = await Water.findOne({
    owner,
    "waterNotes._id": id,
  });
  if (!toDayWaterData) {
    throw HttpError(404, "Not Found");
  }

  let waterRecord = toDayWaterData.waterNotes.find(
    (option) => option.id === id
  );

  const { waterTotal } = toDayWaterData;

  const oldWaterDose = waterRecord.waterDose;

  const waterDoseShift = oldWaterDose - newWaterDose;

  toDayWaterData = await Water.findOneAndUpdate(
    { "waterNotes._id": id },
    {
      $inc: { waterTotal: -waterDoseShift },
      $set: {
        persantRate: Math.round(
          ((waterTotal - waterDoseShift) / userDailyNorma) * 100
        ),
        "waterNotes.$.waterDose": newWaterDose,
        "waterNotes.$.createdDate": newCreatedDate,
      },
    },

    { new: true }
  );
  if (!toDayWaterData) {
    throw HttpError(404, "Not Found after update");
  }

  const updatedWaterNote = toDayWaterData.waterNotes.find(
    (note) => note.id === id
  );

  if (!updatedWaterNote) {
    throw HttpError(404, "Updated water note not found");
  }

  const responseData = {
    ...toDayWaterData.toObject(),
    updatedWaterNote,
  };

  res.status(200).json(responseData);
};

const month = async (req, res) => {
  const { _id: owner } = req.user;
  const { date } = req.query;
  const searchedDate = new Date(date);

  const year = searchedDate.getFullYear(); // Number
  const monthNo = searchedDate.getMonth(); // Number

  const startOfMonth = new Date(Date.UTC(year, monthNo, 0)).toISOString();

  const endOfMonth = new Date(Date.UTC(year, monthNo + 1, 0)).toISOString();

  console.log(startOfMonth);
  console.log(endOfMonth);

  const rawData = await Water.find({
    owner,
    date: { $gte: startOfMonth, $lte: endOfMonth },
  });

  console.log(rawData);
  if (!rawData) {
    throw HttpError(404, "Not Found");
  }

  const daysOfMonth = getDaysOfMonth(year, monthNo);

  const data = daysOfMonth.map((day) => {
    const dayData = rawData.find((item) => {
      const itemDate = Number(item.date.toString().slice(8, 10));

      return itemDate === day;
    });

    const formattedDay = day.toString().padStart(2, "0");
    const formattedMonth = `${monthNo + 1}`.toString().padStart(2, "0");
    const date = `${year}-${formattedMonth}-${formattedDay}`;

    if (dayData) {
      return {
        date: dayData.date,
        dailyNorma: dayData.dailyNorma,
        persantRate: dayData.persantRate,
        waterSavings: dayData.waterSavings,
      };
    } else {
      return {
        date: date,
        dailyNorma: 0,
        persantRate: 0,
        waterSavings: 0,
      };
    }
  });

  res.status(200).json(data);
};

const dailyNorm = async (req, res) => {
  const { _id: owner } = req.user;
  const { dailyNorma: newDailyNorma, date } = req.body;
  const actualDate = new Date().toISOString().substring(0, 10);

  if (!newDailyNorma) {
    throw HttpError(400, "Bad request (invalid request body)");
  }

  const toDayWaterData = await Water.findOne({ owner, date: actualDate });

  const userDailyNorma = await User.findByIdAndUpdate(
    { _id: owner },
    {
      $set: {
        dailyNorma: newDailyNorma,
      },
    },
    { new: true }
  );

  if (!toDayWaterData) {
    const result = await Water.create({
      owner,
      date: actualDate,
      waterTotal: 0,
      persantRate: 0,
      dailyNorma: newDailyNorma,
      waterSavings: 0,
      waterNotes: [],
    });

    return res.status(201).json(result);
  } else {
    const { waterTotal } = toDayWaterData;

    const waterRate = Math.round((waterTotal / newDailyNorma) * 100);
    const result = await Water.findOneAndUpdate(
      { owner, date: actualDate },
      {
        $set: {
          dailyNorma: newDailyNorma,
          persantRate: waterRate,
        },
      },
      { new: true }
    );

    return res.json(result);
  }
};

export default {
  addWater: ctrlWrapper(addWater),
  today: ctrlWrapper(today),
  deleteWaterRecord: ctrlWrapper(deleteWaterRecord),
  updateWaterDose: ctrlWrapper(updateWaterDose),
  month: ctrlWrapper(month),
  dailyNorm: ctrlWrapper(dailyNorm),
};
