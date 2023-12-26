import { bool, Canister, nat, nat64, query, Record, StableBTreeMap, text, update, Void, Vec, nat8, Opt, AzleNull, None, AzleOpt, Some, AzleNat64 } from 'azle';

// Defining record types for different entities

const Room = Record({
    id: nat64,
    doctor_id: nat64,
    current_patient_id: Opt(nat64),
})

type Room = typeof Room.tsType

const Doctor = Record({
    id: nat64,
    name: text,
    is_available: bool,
})

type Doctor = typeof Doctor.tsType

const Patient = Record({
    id: nat64,
    name: text,
    age: nat8,
    gender: text,
    blood_type: text,
})

type Patient = typeof Patient.tsType

type RoomQueue = {
    [room_id: number]: number[];
};

type DoctorRoom = {
    [doctor_id: number]: number;
}

// This is a global variable that is stored on the heap

let patientStorage = StableBTreeMap<nat64, Patient>(0);
let doctorStorage = StableBTreeMap<nat64, Doctor>(1);
let roomStorage = StableBTreeMap<nat64, Room>(2);

let roomQueue: RoomQueue = {};
let doctorRoom: DoctorRoom = {};

export default Canister({

    registerDoctor: update([text], Void, (name) => {
        const id = doctorStorage.len()
        doctorStorage.insert(id, {
            id,
            name,
            is_available: false,
        })
    }),

    getDoctors: query([], Vec(Doctor), () => {
        return doctorStorage.values();
    }),

    registerPatient: update([text, nat8, text, text], Void, (name, age, gender, blood_type) => {
        const id = patientStorage.len()
        patientStorage.insert(id, {
            id,
            name,
            age,
            gender,
            blood_type,
        })
    }),

    getPatients: query([], Vec(Patient), () => {
        return patientStorage.values();
    }),

    registerRoom: update([nat64], Void, (doctor_id) => {
        const id = roomStorage.len()
        roomStorage.insert(id, {
            id,
            doctor_id,
            current_patient_id: None,
        })
    }),

    checkinDoctor: update([nat64], Void, (doctor_id) => {
        const getDoctor = doctorStorage.get(doctor_id)
        if (getDoctor.Some) {
            const doctor = getDoctor.Some!
            doctor.is_available = true
            doctorStorage.insert(doctor_id, doctor)
            const room = roomStorage.values().find((room) => {
                return room.doctor_id == doctor_id
            })
            if (room) {
                roomQueue[Number(room.id)] = []
            }
        }
    }),

    checkoutDoctor: update([nat64], Opt(text), (doctor_id) => {
        const doctor = doctorStorage.get(doctor_id).Some
        if (doctor) {
            const room = roomStorage.values().find((room) => {
                return room.doctor_id === doctor_id
            })
            if (room) {
                if (roomQueue[Number(room.id)].length === 0) {
                    doctor.is_available = false
                    doctorStorage.insert(doctor_id, doctor)
                    return None
                }
                return Some("queue still have patient")
            }
            return Some("room is not found")
        }
        return Some("doctor is not found")
    }),

    allocatePatient: update([nat64, nat64], Opt(text), (patient_id, room_id) => {
        const room = roomStorage.get(room_id).Some
        if (room) {
            const doctor = doctorStorage.get(room.doctor_id).Some
            if (doctor) {
                if (doctor.is_available) {
                    room.current_patient_id = Some(patient_id)
                    roomQueue[Number(room_id)].push(Number(patient_id))
                    return None
                }
                return Some("doctor is not available")
            }
            return Some("doctor is not found")
        }
        return Some("room is not found")
    }),

    nextPatient: update([nat64], Opt(text), (room_id) => {
        const room = roomStorage.get(room_id).Some
        if (room) {
            const doctor = doctorStorage.get(room.doctor_id).Some
            if (doctor) {
                if (doctor.is_available) {
                    roomQueue[Number(room_id)].shift()
                    if (roomQueue[Number(room_id)].length > 0) {
                        AzleNat64
                        room.current_patient_id = Some(BigInt(roomQueue[Number(room_id)][0]))
                        return None
                    }
                    return Some("queue is empty")
                }
                return Some("doctor is not available")
            }
            return Some("doctor is not found")
        }
        return Some("room is not found")
    }),

    queueLength: query([nat64], nat64, (room_id) => {
        return BigInt(roomQueue[Number(room_id)].length)
    }),

    checkAllocation: query([nat64], Opt(nat64), (patient_id) => {
        const queues = Object.values(roomQueue)
        const keys = Object.keys(roomQueue)
        const idx = queues.findIndex((queue) => {
            return queue.includes(Number(patient_id))
        })
        if (idx >= 0) {
            return Some(BigInt(keys[idx]))
        }
        return None
    }),

});

