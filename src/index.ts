import { Canister, nat64, query, Record, StableBTreeMap, text, update, Void, Vec, nat32, Opt, None, Some, nat8 } from 'azle';

// Defining record types for different entities
const Patient = Record({
    id: nat64,
    name: text,
    age: nat8,
    gender: text,
    blood_type: text,
})

type Patient = typeof Patient.tsType

const Appointment = Record({
    date: nat32,
    patients: Vec(nat64),
    quota_left: nat32,
})

type Appointment = typeof Appointment.tsType


// This is a global variable that is stored on the heap

let quotaConfiguration = StableBTreeMap<string, number>(0);
let patientStorage = StableBTreeMap<nat64, Patient>(1);
let appointmentStorage = StableBTreeMap<nat32, Appointment>(2)

// constant
const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export default Canister({

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

    getQuotaConfig: query([text], nat32, (day) => {
        const result = quotaConfiguration.get(day)
        if (result == None) {
            return 0
        }
        return result.Some!
    }),

    setQuotaConfig: update([text, nat32], Void, (day, quota) => {
        quotaConfiguration.insert(day, quota)
    }),

    getQuota: query([nat32], nat32, (date_unix) => {
        const result = appointmentStorage.get(date_unix)
        if (result == None) {
            const date = new Date(date_unix * 1000)
            const day = days[date.getDay()]
            const quotaConfig = quotaConfiguration.get(day)
            if (quotaConfig == None) {
                return 0
            }
            return quotaConfig.Some!
        }
        return result.Some?.quota_left!
    }),

    makeAppointment: update([nat64, nat32], Opt(text), (patient_id, date_unix) => {
        const patient = patientStorage.get(patient_id)
        if (patient == None) {
            return Some("patient not found")
        }
        const appointment = appointmentStorage.get(date_unix)
        if (appointment == None) {
            const date = new Date(date_unix * 1000)
            const day = days[date.getDay()]
            const quota = quotaConfiguration.get(day)
            if (quota == None) {
                return Some("quota of day not set")
            }
            const newAppointment = {
                date: date_unix,
                patients: new BigUint64Array(1),
                quota_left: quota.Some! - 1,
            }
            newAppointment.patients.set([patient_id], 0)
            appointmentStorage.insert(date_unix, newAppointment)
            return None
        }
        const updateAppointment = appointment.Some!
        if (updateAppointment.patients.includes(patient_id)) {
            return Some("patient already registered on that date")
        }
        if (updateAppointment.quota_left < 1) {
            return Some("there is no quota left available")
        }
        const newPatients = new BigUint64Array(updateAppointment.patients.length + 1)
        newPatients.set([...updateAppointment.patients, patient_id])
        updateAppointment.patients = newPatients
        updateAppointment.quota_left--
        appointmentStorage.insert(updateAppointment.date, updateAppointment)
        return None
    })
});

