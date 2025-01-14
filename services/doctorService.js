const moment = require("moment");
const {compareSync} = require("bcrypt");
const {sign} = require("jsonwebtoken");
const Doctor = require("../schemas/doctor.schema");
const Timeslot = require("../schemas/timeslot.schema");
const Appointment = require("../schemas/appointment.schema");


module.exports = {
    loginDoctor: async (data) => {
        const user = await Doctor.findOne({email: data.email});
        if (user) {
            const result = compareSync(
                data.password,
                user.password
            );
            if (result) {
                const jsontoken = sign({result: user}, "secret", {
                    expiresIn: "1day",
                });
                const {_id, name, email, dob, field} = user
                const loggedUser = {
                    token: jsontoken,
                    user: {_id, name, email, dob, field, type: "doctor"}
                };
                return loggedUser;

            } else {
                throw new Error("Invalid password");
            }
        } else {
            throw new Error("Invalid email");
        }

    },
    createTimeslot: async (doctorId, data) => {
        await Timeslot.create({doctorId, startTime: data.startTime, endTime: data.endTime});
    },
    getDoctors: async (filter) => {
        let newFilter;
        let result;
        if (filter.length ==1 && filter[0]==""){
             result = await Doctor.find().select(["name", "email", "field", "dob"]);
        }else{
             const updatedFilter = filter.map((f) => {
                return {field: f}
            });
            newFilter = {$or:updatedFilter};
            result = await Doctor.find(newFilter).select(["name", "email", "field", "dob"]);
        }

        return result;
    },
    getDoctorSlots: async (id) => {
        const currentDate = moment().toDate();
        const result = await Timeslot.find({doctorId: id, startTime: {$gte: currentDate}});
        const map = new Map();
        result.forEach((slot) => {
            const date = `${slot.startTime.getFullYear()}-${slot.startTime.getMonth()}-${slot.startTime.getDate()}`;
            if (!map.get(date)) {
                map.set(date, []);
                map.get(date).push({startTime: slot.startTime, endTime: slot.endTime,timeslotId:slot._id,availability:slot.availability});
            } else {
                map.get(date).push({startTime: slot.startTime, endTime: slot.endTime,timeslotId:slot._id,availability:slot.availability});
            }

        });
        const timeslots = {};
        map.forEach((slot) => {
            const date = `${slot[0].startTime.getFullYear()}-${slot[0].startTime.getMonth()}-${slot[0].startTime.getDate()}`;
            timeslots[date] = slot;
        });
        return timeslots;


    },
    getDoctorDetails: async (id) => {
        const result = await Doctor.findById(id);
        result.password = undefined;
        if (!result) {
            throw new Error("Doctor not found")
        }
        return result;
    },
    getAppointments: async (id) => {
        const result = await Appointment.find({doctorId: id}).populate(["timeslotId","patientId","doctorId"]);
        const currentDate = moment().toDate();
        const updatedAppointments = [];
        result.forEach((appointment) => {
            if (moment(appointment.timeslotId.startTime).isAfter(currentDate)) {
                appointment.doctorId.password = undefined;
                appointment.patientId.password = undefined;
                updatedAppointments.push(appointment);
            }
        });
        return updatedAppointments;
    }

}