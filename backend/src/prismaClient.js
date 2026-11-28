const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const PERSIST_PATH = process.env.ERP_STORE_PATH || '/tmp/school-erp-db.json';

const SCHEMA = {
  user: {
    defaults: { isActive: true, createdAt: () => new Date() },
    uniques: [['id'], ['email'], ['phone']],
    relations: {
      staff: { type: 'hasOne', model: 'staff', foreignKey: 'userId' },
      attendanceMarkedBy: { type: 'hasMany', model: 'attendanceRecord', foreignKey: 'markedById' },
      busExpensesRecorded: { type: 'hasMany', model: 'busExpense', foreignKey: 'recordedById' },
      holidaysCreated: { type: 'hasMany', model: 'holiday', foreignKey: 'createdById' },
      teacherClasses: { type: 'hasMany', model: 'teacherClass', foreignKey: 'userId' },
      permissions: { type: 'hasMany', model: 'staffPermission', foreignKey: 'userId' },
    },
  },
  teacherClass: {
    defaults: { createdAt: () => new Date() },
    uniques: [['id'], { name: 'userId_classId', fields: ['userId', 'classId'] }],
    relations: {
      user: { type: 'belongsTo', model: 'user', foreignKey: 'userId' },
      class: { type: 'belongsTo', model: 'class', foreignKey: 'classId' },
    },
  },
  staffPermission: {
    defaults: { createdAt: () => new Date() },
    uniques: [['id'], { name: 'userId_module', fields: ['userId', 'module'] }],
    relations: {
      user: { type: 'belongsTo', model: 'user', foreignKey: 'userId' },
    },
  },
  student: {
    defaults: { orphanStatus: 'NONE', status: 'REGULAR', createdAt: () => new Date(), updatedAt: () => new Date() },
    uniques: [['id'], ['admissionNumber']],
    relations: {
      class: { type: 'belongsTo', model: 'class', foreignKey: 'classId' },
      busRoute: { type: 'belongsTo', model: 'busRoute', foreignKey: 'busRouteId' },
      previousStudent: { type: 'belongsTo', model: 'student', foreignKey: 'previousStudentId' },
      readmittedAs: { type: 'hasMany', model: 'student', foreignKey: 'previousStudentId' },
      admission: { type: 'hasOne', model: 'admission', foreignKey: 'studentId' },
      withdrawal: { type: 'hasOne', model: 'withdrawal', foreignKey: 'studentId' },
      attendance: { type: 'hasMany', model: 'attendanceRecord', foreignKey: 'studentId' },
      examResults: { type: 'hasMany', model: 'examResult', foreignKey: 'studentId' },
      busFeePayments: { type: 'hasMany', model: 'busFeePayment', foreignKey: 'studentId' },
    },
  },
  class: {
    defaults: {},
    uniques: [['id'], ['name']],
    relations: {
      students: { type: 'hasMany', model: 'student', foreignKey: 'classId' },
      examClasses: { type: 'hasMany', model: 'examClass', foreignKey: 'classId' },
      teacherLinks: { type: 'hasMany', model: 'teacherClass', foreignKey: 'classId' },
    },
  },
  holiday: {
    defaults: { createdAt: () => new Date() },
    uniques: [['id'], ['date']],
    relations: {
      createdBy: { type: 'belongsTo', model: 'user', foreignKey: 'createdById' },
    },
  },
  admission: {
    defaults: { admissionDate: () => new Date() },
    uniques: [['id'], ['studentId']],
    relations: {
      student: { type: 'belongsTo', model: 'student', foreignKey: 'studentId' },
      formDetail: { type: 'hasOne', model: 'admissionFormDetail', foreignKey: 'admissionId' },
    },
  },
  admissionFormDetail: {
    defaults: { nationality: 'PAKISTANI', createdAt: () => new Date(), updatedAt: () => new Date() },
    uniques: [['id'], ['admissionId']],
    relations: {
      admission: { type: 'belongsTo', model: 'admission', foreignKey: 'admissionId' },
    },
  },
  withdrawal: {
    defaults: { withdrawalDate: () => new Date(), transferCertIssued: false },
    uniques: [['id'], ['studentId']],
    relations: {
      student: { type: 'belongsTo', model: 'student', foreignKey: 'studentId' },
    },
  },
  attendanceRecord: {
    defaults: { createdAt: () => new Date() },
    uniques: [['id'], { name: 'studentId_date', fields: ['studentId', 'date'] }],
    relations: {
      student: { type: 'belongsTo', model: 'student', foreignKey: 'studentId' },
      markedBy: { type: 'belongsTo', model: 'user', foreignKey: 'markedById' },
    },
  },
  exam: {
    defaults: { passPercent: 40 },
    uniques: [['id']],
    relations: {
      classes: { type: 'hasMany', model: 'examClass', foreignKey: 'examId' },
      subjects: { type: 'hasMany', model: 'examSubject', foreignKey: 'examId' },
    },
  },
  examClass: {
    defaults: {},
    uniques: [['id'], { name: 'examId_classId', fields: ['examId', 'classId'] }],
    relations: {
      exam: { type: 'belongsTo', model: 'exam', foreignKey: 'examId' },
      class: { type: 'belongsTo', model: 'class', foreignKey: 'classId' },
    },
  },
  examSubject: {
    defaults: { maxMarks: 100, passMarks: 33, appliesTo: 'ALL', sortOrder: 0 },
    uniques: [['id']],
    relations: {
      exam: { type: 'belongsTo', model: 'exam', foreignKey: 'examId' },
      results: { type: 'hasMany', model: 'examResult', foreignKey: 'examSubjectId' },
    },
  },
  examResult: {
    defaults: {},
    uniques: [['id'], { name: 'studentId_examSubjectId', fields: ['studentId', 'examSubjectId'] }],
    relations: {
      student: { type: 'belongsTo', model: 'student', foreignKey: 'studentId' },
      examSubject: { type: 'belongsTo', model: 'examSubject', foreignKey: 'examSubjectId' },
    },
  },
  gradeScale: {
    defaults: { createdAt: () => new Date() },
    uniques: [['id'], ['name']],
    relations: {
      bands: { type: 'hasMany', model: 'gradeBand', foreignKey: 'gradeScaleId' },
    },
  },
  gradeBand: {
    defaults: {},
    uniques: [['id']],
    relations: {
      gradeScale: { type: 'belongsTo', model: 'gradeScale', foreignKey: 'gradeScaleId' },
    },
  },
  vehicle: {
    defaults: { active: true, createdAt: () => new Date() },
    uniques: [['id'], ['vehicleNumber']],
    relations: {
      routes: { type: 'hasMany', model: 'busRoute', foreignKey: 'vehicleId' },
      expenses: { type: 'hasMany', model: 'busExpense', foreignKey: 'vehicleId' },
    },
  },
  busRoute: {
    defaults: { createdAt: () => new Date() },
    uniques: [['id']],
    relations: {
      vehicle: { type: 'belongsTo', model: 'vehicle', foreignKey: 'vehicleId' },
      students: { type: 'hasMany', model: 'student', foreignKey: 'busRouteId' },
      passengers: { type: 'hasMany', model: 'busPassenger', foreignKey: 'busRouteId' },
      payments: { type: 'hasMany', model: 'busFeePayment', foreignKey: 'busRouteId' },
    },
  },
  busPassenger: {
    defaults: { active: true, createdAt: () => new Date() },
    uniques: [['id']],
    relations: {
      busRoute: { type: 'belongsTo', model: 'busRoute', foreignKey: 'busRouteId' },
      payments: { type: 'hasMany', model: 'busFeePayment', foreignKey: 'busPassengerId' },
    },
  },
  busFeePayment: {
    defaults: { discount: 0, paymentDate: () => new Date(), paymentMethod: 'CASH', createdAt: () => new Date() },
    uniques: [
      ['id'],
      { name: 'studentId_month', fields: ['studentId', 'month'] },
      { name: 'busPassengerId_month', fields: ['busPassengerId', 'month'] },
    ],
    relations: {
      student: { type: 'belongsTo', model: 'student', foreignKey: 'studentId' },
      busPassenger: { type: 'belongsTo', model: 'busPassenger', foreignKey: 'busPassengerId' },
      busRoute: { type: 'belongsTo', model: 'busRoute', foreignKey: 'busRouteId' },
    },
  },
  busExpense: {
    defaults: { expenseDate: () => new Date(), createdAt: () => new Date() },
    uniques: [['id']],
    relations: {
      vehicle: { type: 'belongsTo', model: 'vehicle', foreignKey: 'vehicleId' },
      recordedBy: { type: 'belongsTo', model: 'user', foreignKey: 'recordedById' },
    },
  },
  staff: {
    defaults: { category: 'NON_TEACHING', employmentType: 'FULL_TIME', dateJoined: () => new Date(), status: 'ACTIVE', createdAt: () => new Date(), updatedAt: () => new Date() },
    uniques: [['id'], ['employeeId'], ['userId']],
    relations: {
      user: { type: 'belongsTo', model: 'user', foreignKey: 'userId' },
    },
  },
  classSubjectTemplate: {
    defaults: { createdAt: () => new Date(), updatedAt: () => new Date() },
    uniques: [['id']],
    relations: {},
  },
  timetableTeacher: {
    defaults: { isActive: true, createdAt: () => new Date(), updatedAt: () => new Date() },
    uniques: [['id'], ['code']],
    relations: {
      staff: { type: 'belongsTo', model: 'staff', foreignKey: 'staffId' },
      entries: { type: 'hasMany', model: 'timetableEntry', foreignKey: 'teacherId' },
    },
  },
  timetableSlot: {
    defaults: { isBreak: false, sortOrder: 0 },
    uniques: [['id']],
    relations: {
      entries: { type: 'hasMany', model: 'timetableEntry', foreignKey: 'slotId' },
    },
  },
  timetableSchedule: {
    defaults: { isActive: true, createdAt: () => new Date(), updatedAt: () => new Date() },
    uniques: [['id']],
    relations: {
      classes: { type: 'hasMany', model: 'timetableScheduleClass', foreignKey: 'scheduleId' },
    },
  },
  timetableScheduleClass: {
    defaults: {},
    uniques: [['id']],
    relations: {
      schedule: { type: 'belongsTo', model: 'timetableSchedule', foreignKey: 'scheduleId' },
    },
  },
  timetableEntry: {
    defaults: { createdAt: () => new Date(), updatedAt: () => new Date() },
    uniques: [['id']],
    relations: {
      teacher: { type: 'belongsTo', model: 'timetableTeacher', foreignKey: 'teacherId' },
      slot: { type: 'belongsTo', model: 'timetableSlot', foreignKey: 'slotId' },
    },
  },
  timetableAbsence: {
    defaults: { createdAt: () => new Date() },
    uniques: [['id']],
    relations: {
      teacher: { type: 'belongsTo', model: 'timetableTeacher', foreignKey: 'teacherId' },
    },
  },
  timetableArrangement: {
    defaults: { createdAt: () => new Date() },
    uniques: [['id']],
    relations: {},
  },
  institute: {
    defaults: { createdAt: () => new Date(), updatedAt: () => new Date() },
    uniques: [['id']],
    relations: {
      committeeMembers: { type: 'hasMany', model: 'instituteCommitteeMember', foreignKey: 'instituteId' },
      files: { type: 'hasMany', model: 'instituteFile', foreignKey: 'instituteId' },
      meetings: { type: 'hasMany', model: 'instituteMeeting', foreignKey: 'instituteId' },
    },
  },
  instituteCommitteeMember: {
    defaults: { sortOrder: 0, createdAt: () => new Date(), updatedAt: () => new Date() },
    uniques: [['id']],
    relations: {
      institute: { type: 'belongsTo', model: 'institute', foreignKey: 'instituteId' },
    },
  },
  instituteFile: {
    defaults: { createdAt: () => new Date(), updatedAt: () => new Date() },
    uniques: [['id']],
    relations: {
      institute: { type: 'belongsTo', model: 'institute', foreignKey: 'instituteId' },
    },
  },
  instituteMeeting: {
    defaults: { createdAt: () => new Date(), updatedAt: () => new Date() },
    uniques: [['id']],
    relations: {
      institute: { type: 'belongsTo', model: 'institute', foreignKey: 'instituteId' },
    },
  },
  studentSuspension: {
    defaults: { createdAt: () => new Date(), updatedAt: () => new Date() },
    uniques: [['id']],
    relations: {
      student: { type: 'belongsTo', model: 'student', foreignKey: 'studentId' },
    },
  },
};

const DATE_FIELDS = new Set([
  'createdAt', 'updatedAt', 'dateOfBirth', 'date', 'admissionDate',
  'withdrawalDate', 'startDate', 'endDate', 'paymentDate', 'expenseDate', 'dateJoined',
]);

function reviveDates(modelName, row) {
  const out = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (v && DATE_FIELDS.has(k) && typeof v === 'string') {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) out[k] = d;
    }
  }
  return out;
}

function normalizeValue(v) {
  if (v instanceof Date) return v.getTime();
  return v;
}

function valuesEqual(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return a === b;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date && typeof b === 'string') return a.getTime() === new Date(b).getTime();
  if (typeof a === 'string' && b instanceof Date) return new Date(a).getTime() === b.getTime();
  return false;
}

function createStore() {
  const tables = {};
  const counters = {};
  for (const name of Object.keys(SCHEMA)) {
    tables[name] = [];
    counters[name] = 0;
  }
  return { tables, counters };
}

let store = createStore();
let persistTimer = null;

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      fs.writeFileSync(PERSIST_PATH, JSON.stringify(store), 'utf8');
    } catch (e) {
      // ignore ephemeral FS errors
    }
  }, 50);
}

function loadOrSeed() {
  try {
    if (fs.existsSync(PERSIST_PATH)) {
      const raw = JSON.parse(fs.readFileSync(PERSIST_PATH, 'utf8'));
      if (raw && raw.tables && raw.counters && Array.isArray(raw.tables.user) && raw.tables.user.length > 0) {
        const next = createStore();
        for (const name of Object.keys(SCHEMA)) {
          next.tables[name] = (raw.tables[name] || []).map((r) => reviveDates(name, r));
          next.counters[name] = raw.counters[name] || next.tables[name].reduce((m, r) => Math.max(m, r.id || 0), 0);
        }
        store = next;
        return;
      }
    }
  } catch (e) {
    // fall back to fresh seed
  }
  seedInitialData();
}

function insertRaw(modelName, data) {
  const def = SCHEMA[modelName];
  const row = {};
  for (const [k, d] of Object.entries(def.defaults || {})) {
    row[k] = typeof d === 'function' ? d() : d;
  }
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && !(def.relations && def.relations[k])) {
      row[k] = v;
    }
  }
  if (row.id === undefined || row.id === null) {
    store.counters[modelName] += 1;
    row.id = store.counters[modelName];
  } else {
    store.counters[modelName] = Math.max(store.counters[modelName], Number(row.id));
  }
  store.tables[modelName].push(row);
  return row;
}

function seedInitialData() {
  store = createStore();
  const adminHash = bcrypt.hashSync('Admin@123', 10);
  const teacherHash = bcrypt.hashSync('Teacher@123', 10);

  const admin = insertRaw('user', {
    name: 'School Administrator',
    email: 'admin@school.edu',
    phone: null,
    passwordHash: adminHash,
    role: 'ADMIN',
  });

  const teacherUser = insertRaw('user', {
    name: 'Jane Teacher',
    email: 'teacher@school.edu',
    phone: '555-0100',
    passwordHash: teacherHash,
    role: 'TEACHER',
  });

  const c6 = insertRaw('class', { name: 'Grade 6', sections: 'A,B' });
  const c7 = insertRaw('class', { name: 'Grade 7', sections: 'A,B' });
  const c8 = insertRaw('class', { name: 'Grade 8', sections: 'A,B' });

  insertRaw('teacherClass', { userId: teacherUser.id, classId: c6.id, section: null });

  insertRaw('staff', {
    employeeId: 'EMP-001',
    userId: teacherUser.id,
    firstName: 'Jane',
    lastName: 'Teacher',
    designation: 'Mathematics Teacher',
    department: 'Mathematics',
    category: 'TEACHING',
    employmentType: 'FULL_TIME',
    phone: '555-0100',
    email: 'teacher@school.edu',
    qualifications: 'M.Sc. Mathematics',
  });

  const vehicle = insertRaw('vehicle', {
    vehicleNumber: 'SCH-101',
    model: 'Toyota Coaster',
    capacity: 30,
    driverName: 'Muhammad Rafiq',
    driverPhone: '555-0300',
  });

  const busRoute = insertRaw('busRoute', {
    name: 'Route 1 - City Center',
    monthlyFee: 2500,
    vehicleId: vehicle.id,
  });

  insertRaw('busPassenger', {
    name: 'Hamza Khan',
    guardianName: 'Ali Khan Sr.',
    guardianPhone: '555-0200',
    busRouteId: busRoute.id,
    pickupPoint: 'Main Gate Stop',
    note: 'Junior section - not yet enrolled, younger sibling of STU-0001',
  });

  const sampleStudents = [
    { admissionNumber: 'STU-0001', firstName: 'Ali', lastName: 'Khan', gender: 'MALE', classId: c6.id, section: 'A', rollNumber: '1', status: 'REGULAR', onBus: true },
    { admissionNumber: 'STU-0002', firstName: 'Fatima', lastName: 'Ahmed', gender: 'FEMALE', classId: c6.id, section: 'A', rollNumber: '2', status: 'REGULAR', onBus: false },
    { admissionNumber: 'STU-0003', firstName: 'Bilal', lastName: 'Hussain', gender: 'MALE', classId: c7.id, section: 'A', rollNumber: '1', status: 'REGULAR', onBus: true },
    { admissionNumber: 'STU-0004', firstName: 'Sara', lastName: 'Malik', gender: 'FEMALE', classId: c8.id, section: 'A', rollNumber: '1', status: 'PASSOUT', onBus: false },
    { admissionNumber: 'STU-0005', firstName: 'Usman', lastName: 'Sheikh', gender: 'MALE', classId: c7.id, section: 'B', rollNumber: '2', status: 'STRUCK_OFF', onBus: false },
  ];

  for (const s of sampleStudents) {
    const student = insertRaw('student', {
      admissionNumber: s.admissionNumber,
      firstName: s.firstName,
      lastName: s.lastName,
      dateOfBirth: new Date('2013-05-15'),
      gender: s.gender,
      classId: s.classId,
      section: s.section,
      rollNumber: s.rollNumber,
      status: s.status,
      guardianName: `${s.lastName} Guardian`,
      guardianPhone: '555-0200',
      busRouteId: s.onBus ? busRoute.id : null,
      busPickupPoint: s.onBus ? 'Main Gate Stop' : null,
    });
    insertRaw('admission', {
      studentId: student.id,
      academicYear: '2026-2027',
      documentsReceived: 'Birth Certificate,Previous Report Card',
    });
  }

  insertRaw('busExpense', {
    vehicleId: vehicle.id,
    category: 'REPAIR',
    description: 'Replaced front brake pads',
    amount: 4500,
    vendorName: 'City Auto Workshop',
    odometerReading: 45210,
    recordedById: admin.id,
  });

  const defaultScale = insertRaw('gradeScale', {
    name: 'Default (all classes)',
    minGrade: null,
    maxGrade: null,
  });
  const bands = [
    { grade: 'A+', minPercent: 90, gradePoint: 6, remarks: 'Outstanding' },
    { grade: 'A', minPercent: 80, gradePoint: 5, remarks: 'Excellent' },
    { grade: 'B', minPercent: 70, gradePoint: 4, remarks: 'Very Good' },
    { grade: 'C', minPercent: 60, gradePoint: 3, remarks: 'Good' },
    { grade: 'D', minPercent: 50, gradePoint: 2, remarks: 'Fair' },
    { grade: 'E', minPercent: 40, gradePoint: 1, remarks: 'Pass' },
    { grade: 'F', minPercent: 0, gradePoint: 0, remarks: 'Needs Improvement' },
  ];
  for (const b of bands) {
    insertRaw('gradeBand', { gradeScaleId: defaultScale.id, ...b });
  }

  schedulePersist();
}

function matchesCondition(value, cond) {
  if (cond === null || cond === undefined) {
    return value === cond;
  }
  if (typeof cond !== 'object' || cond instanceof Date) {
    return valuesEqual(value, cond);
  }
  // Filter operators
  if ('equals' in cond) {
    if (!valuesEqual(value, cond.equals)) return false;
  }
  if ('not' in cond) {
    if (cond.not === null) {
      if (value === null || value === undefined) return false;
    } else if (typeof cond.not === 'object' && !(cond.not instanceof Date)) {
      if (matchesCondition(value, cond.not)) return false;
    } else if (valuesEqual(value, cond.not)) {
      return false;
    }
  }
  if ('in' in cond) {
    if (!cond.in.some((item) => valuesEqual(value, item))) return false;
  }
  if ('notIn' in cond) {
    if (cond.notIn.some((item) => valuesEqual(value, item))) return false;
  }
  if ('gt' in cond) {
    if (value == null || normalizeValue(value) <= normalizeValue(cond.gt)) return false;
  }
  if ('gte' in cond) {
    if (value == null || normalizeValue(value) < normalizeValue(cond.gte)) return false;
  }
  if ('lt' in cond) {
    if (value == null || normalizeValue(value) >= normalizeValue(cond.lt)) return false;
  }
  if ('lte' in cond) {
    if (value == null || normalizeValue(value) > normalizeValue(cond.lte)) return false;
  }
  if ('contains' in cond) {
    if (typeof value !== 'string') return false;
    if (!value.toLowerCase().includes(String(cond.contains).toLowerCase())) return false;
  }
  if ('startsWith' in cond) {
    if (typeof value !== 'string') return false;
    if (!value.toLowerCase().startsWith(String(cond.startsWith).toLowerCase())) return false;
  }
  if ('endsWith' in cond) {
    if (typeof value !== 'string') return false;
    if (!value.toLowerCase().endsWith(String(cond.endsWith).toLowerCase())) return false;
  }
  return true;
}

function matchesWhere(modelName, row, where) {
  if (!where) return true;
  const def = SCHEMA[modelName];
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === 'AND') {
      const list = Array.isArray(cond) ? cond : [cond];
      if (!list.every((sub) => matchesWhere(modelName, row, sub))) return false;
      continue;
    }
    if (key === 'OR') {
      if (!cond.some((sub) => matchesWhere(modelName, row, sub))) return false;
      continue;
    }
    if (key === 'NOT') {
      const list = Array.isArray(cond) ? cond : [cond];
      if (list.some((sub) => matchesWhere(modelName, row, sub))) return false;
      continue;
    }

    // Compound unique wrapper in findUnique
    const compoundUnique = (def.uniques || []).find((u) => !Array.isArray(u) && u.name === key);
    if (compoundUnique && typeof cond === 'object' && cond !== null) {
      for (const f of compoundUnique.fields) {
        if (!valuesEqual(row[f], cond[f])) return false;
      }
      continue;
    }

    // Relation filter
    const rel = def.relations && def.relations[key];
    if (rel) {
      if (rel.type === 'belongsTo') {
        const fk = row[rel.foreignKey];
        const target = fk != null ? store.tables[rel.model].find((r) => r.id === fk) || null : null;
        if (cond === null) {
          if (target !== null) return false;
        } else if (cond.is !== undefined) {
          if (cond.is === null ? target !== null : !target || !matchesWhere(rel.model, target, cond.is)) return false;
        } else if (cond.isNot !== undefined) {
          if (cond.isNot === null ? target === null : target && matchesWhere(rel.model, target, cond.isNot)) return false;
        } else {
          if (!target || !matchesWhere(rel.model, target, cond)) return false;
        }
        continue;
      }
      if (rel.type === 'hasOne') {
        const target = store.tables[rel.model].find((r) => r[rel.foreignKey] === row.id) || null;
        if (cond === null) {
          if (target !== null) return false;
        } else if (!target || !matchesWhere(rel.model, target, cond)) {
          return false;
        }
        continue;
      }
      if (rel.type === 'hasMany') {
        const children = store.tables[rel.model].filter((r) => r[rel.foreignKey] === row.id);
        if (cond.some && !children.some((c) => matchesWhere(rel.model, c, cond.some))) return false;
        if (cond.every && !children.every((c) => matchesWhere(rel.model, c, cond.every))) return false;
        if (cond.none && children.some((c) => matchesWhere(rel.model, c, cond.none))) return false;
        continue;
      }
    }

    if (!matchesCondition(row[key], cond)) return false;
  }
  return true;
}

function compareValues(a, b, dir = 'asc') {
  const mult = dir === 'desc' ? -1 : 1;
  if (a == null && b == null) return 0;
  if (a == null) return 1 * mult;
  if (b == null) return -1 * mult;
  const va = normalizeValue(a);
  const vb = normalizeValue(b);
  if (typeof va === 'string' && typeof vb === 'string') {
    return va.localeCompare(vb) * mult;
  }
  if (va < vb) return -1 * mult;
  if (va > vb) return 1 * mult;
  return 0;
}

function applyOrderBy(rows, orderBy) {
  if (!orderBy) return rows;
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const spec of specs) {
      for (const [k, dir] of Object.entries(spec)) {
        if (typeof dir === 'string') {
          const cmp = compareValues(a[k], b[k], dir);
          if (cmp !== 0) return cmp;
        }
      }
    }
    return 0;
  });
}

function projectRow(modelName, row, query = {}) {
  if (!row) return null;
  const def = SCHEMA[modelName];
  const { include, select } = query;

  if (select) {
    const out = {};
    for (const [k, v] of Object.entries(select)) {
      if (!v) continue;
      if (k === '_count') {
        out._count = computeCount(modelName, row, v);
        continue;
      }
      const rel = def.relations && def.relations[k];
      if (rel) {
        out[k] = resolveRelation(modelName, row, rel, typeof v === 'object' ? v : {});
      } else {
        out[k] = row[k] instanceof Date ? new Date(row[k]) : row[k];
      }
    }
    return out;
  }

  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Date ? new Date(v) : v;
  }

  if (include) {
    for (const [k, v] of Object.entries(include)) {
      if (!v) continue;
      if (k === '_count') {
        out._count = computeCount(modelName, row, v);
        continue;
      }
      const rel = def.relations && def.relations[k];
      if (rel) {
        out[k] = resolveRelation(modelName, row, rel, typeof v === 'object' ? v : {});
      }
    }
  }
  return out;
}

function computeCount(modelName, row, countSpec) {
  const def = SCHEMA[modelName];
  const counts = {};
  const selectMap = countSpec && countSpec.select ? countSpec.select : {};
  for (const [relName, enabled] of Object.entries(selectMap)) {
    if (!enabled) continue;
    const rel = def.relations && def.relations[relName];
    if (rel && rel.type === 'hasMany') {
      counts[relName] = store.tables[rel.model].filter((r) => r[rel.foreignKey] === row.id).length;
    } else {
      counts[relName] = 0;
    }
  }
  return counts;
}

function resolveRelation(modelName, row, rel, subQuery = {}) {
  if (rel.type === 'belongsTo') {
    const fk = row[rel.foreignKey];
    if (fk == null) return null;
    const target = store.tables[rel.model].find((r) => r.id === fk);
    return target ? projectRow(rel.model, target, subQuery) : null;
  }
  if (rel.type === 'hasOne') {
    const target = store.tables[rel.model].find((r) => r[rel.foreignKey] === row.id);
    return target ? projectRow(rel.model, target, subQuery) : null;
  }
  if (rel.type === 'hasMany') {
    let children = store.tables[rel.model].filter((r) => r[rel.foreignKey] === row.id);
    if (subQuery.where) {
      children = children.filter((c) => matchesWhere(rel.model, c, subQuery.where));
    }
    if (subQuery.orderBy) {
      children = applyOrderBy(children, subQuery.orderBy);
    }
    if (subQuery.take != null) {
      children = children.slice(0, subQuery.take);
    }
    return children.map((c) => projectRow(rel.model, c, subQuery));
  }
  return null;
}

function checkUniqueViolation(modelName, row, ignoreId = null) {
  const def = SCHEMA[modelName];
  for (const u of def.uniques || []) {
    const fields = Array.isArray(u) ? u : u.fields;
    if (fields.some((f) => row[f] === null || row[f] === undefined)) continue;
    const clash = store.tables[modelName].find(
      (existing) =>
        existing.id !== ignoreId &&
        fields.every((f) => valuesEqual(existing[f], row[f]))
    );
    if (clash) {
      const err = new Error(`Unique constraint failed on ${modelName} (${fields.join(', ')})`);
      err.code = 'P2002';
      err.meta = { target: fields };
      throw err;
    }
  }
}

function createRecordSync(modelName, data) {
  const def = SCHEMA[modelName];
  const row = {};
  for (const [k, d] of Object.entries(def.defaults || {})) {
    row[k] = typeof d === 'function' ? d() : d;
  }

  const nestedCreates = [];
  for (const [k, v] of Object.entries(data || {})) {
    if (v === undefined) continue;
    const rel = def.relations && def.relations[k];
    if (rel) {
      if (v && typeof v === 'object' && v.create) {
        nestedCreates.push({ rel, items: Array.isArray(v.create) ? v.create : [v.create] });
      } else if (v && typeof v === 'object' && v.connect && rel.type === 'belongsTo') {
        row[rel.foreignKey] = v.connect.id;
      }
      continue;
    }
    row[k] = v;
  }

  if (row.id === undefined || row.id === null) {
    store.counters[modelName] += 1;
    row.id = store.counters[modelName];
  } else {
    store.counters[modelName] = Math.max(store.counters[modelName], Number(row.id));
  }

  checkUniqueViolation(modelName, row);
  store.tables[modelName].push(row);

  for (const { rel, items } of nestedCreates) {
    for (const item of items) {
      createRecordSync(rel.model, { ...item, [rel.foreignKey]: row.id });
    }
  }

  schedulePersist();
  return row;
}

function updateRecordSync(modelName, targetRow, data) {
  const def = SCHEMA[modelName];
  const updated = { ...targetRow };
  if ('updatedAt' in (def.defaults || {})) {
    updated.updatedAt = new Date();
  }

  const nestedOps = [];
  for (const [k, v] of Object.entries(data || {})) {
    if (v === undefined) continue;
    const rel = def.relations && def.relations[k];
    if (rel) {
      if (v && typeof v === 'object') {
        if (v.deleteMany !== undefined) {
          nestedOps.push({ type: 'deleteMany', rel, where: v.deleteMany });
        }
        if (v.create) {
          nestedOps.push({
            type: 'create',
            rel,
            items: Array.isArray(v.create) ? v.create : [v.create],
          });
        }
      }
      continue;
    }
    if (v && typeof v === 'object' && 'increment' in v) {
      updated[k] = (Number(updated[k]) || 0) + Number(v.increment);
    } else if (v && typeof v === 'object' && 'decrement' in v) {
      updated[k] = (Number(updated[k]) || 0) - Number(v.decrement);
    } else {
      updated[k] = v;
    }
  }

  checkUniqueViolation(modelName, updated, targetRow.id);
  const idx = store.tables[modelName].findIndex((r) => r.id === targetRow.id);
  store.tables[modelName][idx] = updated;

  for (const op of nestedOps) {
    if (op.type === 'deleteMany') {
      store.tables[op.rel.model] = store.tables[op.rel.model].filter(
        (c) => !(c[op.rel.foreignKey] === updated.id && matchesWhere(op.rel.model, c, op.where))
      );
    } else if (op.type === 'create') {
      for (const item of op.items) {
        createRecordSync(op.rel.model, { ...item, [op.rel.foreignKey]: updated.id });
      }
    }
  }

  schedulePersist();
  return updated;
}

function createModelDelegate(modelName) {
  return {
    async findMany(query = {}) {
      let rows = store.tables[modelName].filter((r) => matchesWhere(modelName, r, query.where));
      if (query.orderBy) {
        rows = applyOrderBy(rows, query.orderBy);
      }
      if (query.distinct && Array.isArray(query.distinct)) {
        const seen = new Set();
        rows = rows.filter((r) => {
          const key = query.distinct.map((f) => JSON.stringify(normalizeValue(r[f]))).join('|');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      if (query.skip != null) rows = rows.slice(query.skip);
      if (query.take != null) rows = rows.slice(0, query.take);
      return rows.map((r) => projectRow(modelName, r, query));
    },

    async findFirst(query = {}) {
      const list = await this.findMany({ ...query, take: 1 });
      return list[0] || null;
    },

    async findUnique(query = {}) {
      const row = store.tables[modelName].find((r) => matchesWhere(modelName, r, query.where));
      return row ? projectRow(modelName, row, query) : null;
    },

    async count(query = {}) {
      return store.tables[modelName].filter((r) => matchesWhere(modelName, r, query.where)).length;
    },

    async create(query = {}) {
      const row = createRecordSync(modelName, query.data);
      return projectRow(modelName, row, query);
    },

    async createMany(query = {}) {
      const list = Array.isArray(query.data) ? query.data : [];
      let count = 0;
      for (const item of list) {
        try {
          createRecordSync(modelName, item);
          count += 1;
        } catch (err) {
          if (query.skipDuplicates && err.code === 'P2002') continue;
          throw err;
        }
      }
      return { count };
    },

    async update(query = {}) {
      const row = store.tables[modelName].find((r) => matchesWhere(modelName, r, query.where));
      if (!row) {
        const err = new Error(`Record not found in ${modelName}`);
        err.code = 'P2025';
        throw err;
      }
      const updated = updateRecordSync(modelName, row, query.data);
      return projectRow(modelName, updated, query);
    },

    async updateMany(query = {}) {
      const matches = store.tables[modelName].filter((r) => matchesWhere(modelName, r, query.where));
      for (const row of matches) {
        updateRecordSync(modelName, row, query.data);
      }
      return { count: matches.length };
    },

    async upsert(query = {}) {
      const existing = store.tables[modelName].find((r) => matchesWhere(modelName, r, query.where));
      if (existing) {
        const updated = updateRecordSync(modelName, existing, query.update);
        return projectRow(modelName, updated, query);
      }
      const created = createRecordSync(modelName, query.create);
      return projectRow(modelName, created, query);
    },

    async delete(query = {}) {
      const idx = store.tables[modelName].findIndex((r) => matchesWhere(modelName, r, query.where));
      if (idx === -1) {
        const err = new Error(`Record not found in ${modelName}`);
        err.code = 'P2025';
        throw err;
      }
      const [removed] = store.tables[modelName].splice(idx, 1);
      schedulePersist();
      return projectRow(modelName, removed, query);
    },

    async deleteMany(query = {}) {
      const before = store.tables[modelName].length;
      store.tables[modelName] = store.tables[modelName].filter((r) => !matchesWhere(modelName, r, query.where));
      const count = before - store.tables[modelName].length;
      if (count > 0) schedulePersist();
      return { count };
    },
  };
}

loadOrSeed();

const prisma = {
  $transaction: async (arg) => {
    if (typeof arg === 'function') {
      const snapshot = JSON.stringify(store);
      try {
        return await arg(prisma);
      } catch (err) {
        const raw = JSON.parse(snapshot);
        const restored = createStore();
        for (const name of Object.keys(SCHEMA)) {
          restored.tables[name] = (raw.tables[name] || []).map((r) => reviveDates(name, r));
          restored.counters[name] = raw.counters[name] || 0;
        }
        store = restored;
        throw err;
      }
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return [];
  },
  $disconnect: async () => {},
  $connect: async () => {},
};

for (const modelName of Object.keys(SCHEMA)) {
  prisma[modelName] = createModelDelegate(modelName);
}

module.exports = prisma;
