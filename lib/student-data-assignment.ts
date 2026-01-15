import seedrandom from 'seedrandom';

/**
 * Full dataset for Exercise 3 (HW3)
 * This data is extracted from initializeExercise3Data() in submissions.ts
 */
export const EXERCISE3_FULL_DATASET = {
  Students: [
    { StudentID: '87369214', FirstName: 'John', LastName: 'Doe', BirthDate: '1999-05-15', City: 'Tel Aviv', Email: 'john.doe@gmail.com' },
    { StudentID: '194DEF23', FirstName: 'Jane', LastName: 'Smith', BirthDate: '2000-07-22', City: 'Haifa', Email: 'jane.smith@gmail.com' },
    { StudentID: '38741562', FirstName: 'Michael', LastName: 'Brown', BirthDate: '1998-12-01', City: 'Jerusalem', Email: 'michael.brown@gmail.com' },
    { StudentID: '95718234', FirstName: 'Emily', LastName: 'Davis', BirthDate: '2001-03-14', City: 'Beer Sheva', Email: 'emily.davis@gmail.com' },
    { StudentID: '21394GHI', FirstName: 'Daniel', LastName: 'Wilson', BirthDate: '1997-11-09', City: 'Herzliya', Email: 'daniel.wilson@gmail.com' },
    { StudentID: '48273916', FirstName: 'Sarah', LastName: 'Thompson', BirthDate: '2002-06-18', City: 'Petah Tikva', Email: 'sarah.thompson@gmail.com' },
    { StudentID: '63918472', FirstName: 'Robert', LastName: 'Johnson', BirthDate: '1999-08-21', City: 'Ramat Gan', Email: 'robert.johnson@gmail.com' },
    { StudentID: '75193486', FirstName: 'Laura', LastName: 'Martinez', BirthDate: '2000-04-12', City: 'Netanya', Email: 'laura.martinez@gmail.com' },
    { StudentID: '28471639', FirstName: 'James', LastName: 'Taylor', BirthDate: '2001-09-25', City: 'Tel Aviv', Email: 'james.taylor@gmail.com' },
    { StudentID: '56782941', FirstName: 'Olivia', LastName: 'White', BirthDate: '2000-02-14', City: 'Haifa', Email: 'olivia.white@gmail.com' },
    { StudentID: '39284756', FirstName: 'William', LastName: 'Harris', BirthDate: '1999-11-08', City: 'Jerusalem', Email: 'william.harris@gmail.com' },
    { StudentID: '64829173', FirstName: 'Sophia', LastName: 'Martin', BirthDate: '2002-04-30', City: 'Beer Sheva', Email: 'sophia.martin@gmail.com' },
    { StudentID: '71938462', FirstName: 'Benjamin', LastName: 'Garcia', BirthDate: '1998-07-19', City: 'Herzliya', Email: 'benjamin.garcia@gmail.com' },
    { StudentID: '83572914', FirstName: 'Isabella', LastName: 'Rodriguez', BirthDate: '2001-12-03', City: 'Petah Tikva', Email: 'isabella.rodriguez@gmail.com' },
    { StudentID: '46281937', FirstName: 'Lucas', LastName: 'Lewis', BirthDate: '2000-05-27', City: 'Ramat Gan', Email: 'lucas.lewis@gmail.com' },
    { StudentID: '92738461', FirstName: 'Mia', LastName: 'Walker', BirthDate: '1999-10-11', City: 'Netanya', Email: 'mia.walker@gmail.com' },
    { StudentID: '18374629', FirstName: 'Henry', LastName: 'Hall', BirthDate: '2002-01-22', City: 'Tel Aviv', Email: 'henry.hall@gmail.com' },
    { StudentID: '74938216', FirstName: 'Charlotte', LastName: 'Allen', BirthDate: '2001-08-05', City: 'Haifa', Email: 'charlotte.allen@gmail.com' },
    { StudentID: '52839174', FirstName: 'Alexander', LastName: 'Young', BirthDate: '1998-03-16', City: 'Jerusalem', Email: 'alexander.young@gmail.com' },
    { StudentID: '69482735', FirstName: 'Amelia', LastName: 'King', BirthDate: '2000-06-28', City: 'Beer Sheva', Email: 'amelia.king@gmail.com' },
    { StudentID: '37192846', FirstName: 'Mason', LastName: 'Wright', BirthDate: '1999-12-09', City: 'Herzliya', Email: 'mason.wright@gmail.com' },
    { StudentID: '85629374', FirstName: 'Harper', LastName: 'Lopez', BirthDate: '2002-02-20', City: 'Petah Tikva', Email: 'harper.lopez@gmail.com' },
    { StudentID: '42918376', FirstName: 'Ethan', LastName: 'Hill', BirthDate: '2001-09-13', City: 'Ramat Gan', Email: 'ethan.hill@gmail.com' },
    { StudentID: '71829463', FirstName: 'Evelyn', LastName: 'Scott', BirthDate: '2000-04-25', City: 'Netanya', Email: 'evelyn.scott@gmail.com' },
    { StudentID: '56372819', FirstName: 'Aiden', LastName: 'Green', BirthDate: '1998-11-07', City: 'Tel Aviv', Email: 'aiden.green@gmail.com' },
    { StudentID: '84729163', FirstName: 'Abigail', LastName: 'Adams', BirthDate: '2001-07-19', City: 'Haifa', Email: 'abigail.adams@gmail.com' },
    { StudentID: '39281746', FirstName: 'Noah', LastName: 'Baker', BirthDate: '1999-01-31', City: 'Jerusalem', Email: 'noah.baker@gmail.com' },
    { StudentID: '62839471', FirstName: 'Elizabeth', LastName: 'Nelson', BirthDate: '2002-05-14', City: 'Beer Sheva', Email: 'elizabeth.nelson@gmail.com' },
    { StudentID: '17483926', FirstName: 'Liam', LastName: 'Carter', BirthDate: '2000-10-26', City: 'Herzliya', Email: 'liam.carter@gmail.com' },
    { StudentID: '73928461', FirstName: 'Sofia', LastName: 'Mitchell', BirthDate: '1998-08-08', City: 'Petah Tikva', Email: 'sofia.mitchell@gmail.com' },
    { StudentID: '48572913', FirstName: 'Logan', LastName: 'Perez', BirthDate: '2001-03-21', City: 'Ramat Gan', Email: 'logan.perez@gmail.com' },
    { StudentID: '61938472', FirstName: 'Avery', LastName: 'Roberts', BirthDate: '2000-12-04', City: 'Netanya', Email: 'avery.roberts@gmail.com' },
    { StudentID: '82739164', FirstName: 'Jackson', LastName: 'Turner', BirthDate: '1999-06-17', City: 'Tel Aviv', Email: 'jackson.turner@gmail.com' },
    { StudentID: '39482715', FirstName: 'Ella', LastName: 'Phillips', BirthDate: '2002-09-29', City: 'Haifa', Email: 'ella.phillips@gmail.com' },
    { StudentID: '72839461', FirstName: 'Levi', LastName: 'Campbell', BirthDate: '2001-02-11', City: 'Jerusalem', Email: 'levi.campbell@gmail.com' },
    { StudentID: '56381947', FirstName: 'Scarlett', LastName: 'Parker', BirthDate: '2000-08-23', City: 'Beer Sheva', Email: 'scarlett.parker@gmail.com' },
    { StudentID: '81937462', FirstName: 'Sebastian', LastName: 'Evans', BirthDate: '1998-04-06', City: 'Herzliya', Email: 'sebastian.evans@gmail.com' },
    { StudentID: '47283916', FirstName: 'Victoria', LastName: 'Edwards', BirthDate: '2001-11-18', City: 'Petah Tikva', Email: 'victoria.edwards@gmail.com' },
    { StudentID: '63829174', FirstName: 'Jack', LastName: 'Collins', BirthDate: '2000-05-01', City: 'Ramat Gan', Email: 'jack.collins@gmail.com' },
    { StudentID: '72938416', FirstName: 'Aria', LastName: 'Stewart', BirthDate: '1999-01-13', City: 'Netanya', Email: 'aria.stewart@gmail.com' },
    { StudentID: '38472961', FirstName: 'Owen', LastName: 'Sanchez', BirthDate: '2002-07-25', City: 'Tel Aviv', Email: 'owen.sanchez@gmail.com' },
    { StudentID: '59183746', FirstName: 'Grace', LastName: 'Morris', BirthDate: '2001-10-07', City: 'Haifa', Email: 'grace.morris@gmail.com' },
  ],
  Courses: [
    { CourseID: 101, CourseName: 'Introduction to CS', Credits: 4, Department: 'Computer Science' },
    { CourseID: 102, CourseName: 'Organic Chemistry', Credits: 3, Department: 'Chemistry' },
    { CourseID: 103, CourseName: 'Modern Physics', Credits: 4, Department: 'Chemistry' },
    { CourseID: 104, CourseName: 'Calculus I', Credits: 3, Department: 'Mathematics' },
    { CourseID: 105, CourseName: 'General Biology', Credits: 5, Department: 'Biology' },
    { CourseID: 106, CourseName: 'Database', Credits: 4, Department: 'Computer Science' },
    { CourseID: 107, CourseName: 'Statistics', Credits: 3, Department: 'Mathematics' },
    { CourseID: 108, CourseName: 'Data Structures', Credits: 4, Department: 'Computer Science' },
    { CourseID: 109, CourseName: 'Algorithms', Credits: 4, Department: 'Computer Science' },
    { CourseID: 110, CourseName: 'Software Engineering', Credits: 5, Department: 'Computer Science' },
    { CourseID: 111, CourseName: 'Linear Algebra', Credits: 3, Department: 'Mathematics' },
    { CourseID: 112, CourseName: 'Calculus II', Credits: 3, Department: 'Mathematics' },
    { CourseID: 113, CourseName: 'Discrete Mathematics', Credits: 4, Department: 'Mathematics' },
    { CourseID: 114, CourseName: 'Inorganic Chemistry', Credits: 3, Department: 'Chemistry' },
    { CourseID: 115, CourseName: 'Biochemistry', Credits: 4, Department: 'Chemistry' },
    { CourseID: 116, CourseName: 'Cell Biology', Credits: 4, Department: 'Biology' },
    { CourseID: 117, CourseName: 'Genetics', Credits: 5, Department: 'Biology' },
    { CourseID: 118, CourseName: 'Ecology', Credits: 3, Department: 'Biology' },
    { CourseID: 119, CourseName: 'Probability Theory', Credits: 3, Department: 'Mathematics' },
    { CourseID: 120, CourseName: 'Machine Learning', Credits: 5, Department: 'Computer Science' },
    { CourseID: 121, CourseName: 'Web Development', Credits: 4, Department: 'Computer Science' },
    { CourseID: 122, CourseName: 'Operating Systems', Credits: 4, Department: 'Computer Science' },
  ],
  Lecturers: [
    { LecturerID: 'ABC95716', FirstName: 'Alice', LastName: 'Johnson', City: 'Tel Aviv', HireDate: '2010-08-15', CourseID: 101, Seniority: '14' },
    { LecturerID: '74819253', FirstName: 'Bob', LastName: 'Lee', City: 'Haifa', HireDate: '2015-01-30', CourseID: 106, Seniority: 'D' },
    { LecturerID: '91738254', FirstName: 'Carol', LastName: 'Miller', City: 'Jerusalem', HireDate: '2012-09-22', CourseID: 103, Seniority: '12' },
    { LecturerID: '28194675', FirstName: 'David', LastName: 'Anderson', City: 'Ramat Gan', HireDate: '2008-03-10', CourseID: 104, Seniority: '16' },
    { LecturerID: '62719384', FirstName: 'Eve', LastName: 'Clark', City: 'Netanya', HireDate: '2011-11-05', CourseID: 105, Seniority: '13' },
    { LecturerID: '34982715', FirstName: 'Frank', LastName: 'Harris', City: 'Beer Sheva', HireDate: '2009-06-18', CourseID: 102, Seniority: '15' },
    { LecturerID: '48273916', FirstName: 'George', LastName: 'Moore', City: 'Tel Aviv', HireDate: '2013-04-20', CourseID: 108, Seniority: '11' },
    { LecturerID: '63918472', FirstName: 'Helen', LastName: 'Taylor', City: 'Haifa', HireDate: '2014-07-12', CourseID: 109, Seniority: '10' },
    { LecturerID: '75193486', FirstName: 'Ian', LastName: 'Wilson', City: 'Jerusalem', HireDate: '2016-02-28', CourseID: 110, Seniority: '8' },
    { LecturerID: '28471639', FirstName: 'Julia', LastName: 'Brown', City: 'Ramat Gan', HireDate: '2011-09-05', CourseID: 111, Seniority: '13' },
    { LecturerID: '56782941', FirstName: 'Kevin', LastName: 'Davis', City: 'Netanya', HireDate: '2012-11-18', CourseID: 112, Seniority: '12' },
    { LecturerID: '39284756', FirstName: 'Linda', LastName: 'Miller', City: 'Beer Sheva', HireDate: '2015-05-22', CourseID: 113, Seniority: '9' },
    { LecturerID: '64829173', FirstName: 'Mark', LastName: 'Garcia', City: 'Tel Aviv', HireDate: '2009-03-14', CourseID: 114, Seniority: '15' },
    { LecturerID: '71938462', FirstName: 'Nancy', LastName: 'Rodriguez', City: 'Haifa', HireDate: '2010-10-30', CourseID: 115, Seniority: '14' },
    { LecturerID: '83572914', FirstName: 'Oliver', LastName: 'Martinez', City: 'Jerusalem', HireDate: '2014-01-08', CourseID: 116, Seniority: '10' },
    { LecturerID: '46281937', FirstName: 'Patricia', LastName: 'Lopez', City: 'Ramat Gan', HireDate: '2013-06-25', CourseID: 117, Seniority: '11' },
    { LecturerID: '92738461', FirstName: 'Quinn', LastName: 'Gonzalez', City: 'Netanya', HireDate: '2016-08-17', CourseID: 118, Seniority: '8' },
    { LecturerID: '18374629', FirstName: 'Rachel', LastName: 'Hernandez', City: 'Beer Sheva', HireDate: '2011-12-03', CourseID: 119, Seniority: '13' },
    { LecturerID: '74938216', FirstName: 'Samuel', LastName: 'Smith', City: 'Tel Aviv', HireDate: '2012-04-19', CourseID: 120, Seniority: '12' },
    { LecturerID: '52839174', FirstName: 'Tina', LastName: 'Johnson', City: 'Haifa', HireDate: '2015-09-11', CourseID: 121, Seniority: '9' },
    { LecturerID: '69482735', FirstName: 'Victor', LastName: 'Williams', City: 'Jerusalem', HireDate: '2014-11-26', CourseID: 122, Seniority: '10' },
  ],
  Enrollments: [
    { StudentID: '87369214', CourseID: 101, EnrollmentDate: '2023-09-01', Grade: 92 },
    { StudentID: '87369214', CourseID: 104, EnrollmentDate: '2023-09-01', Grade: 76 },
    { StudentID: '87369214', CourseID: 106, EnrollmentDate: '2024-06-10', Grade: 61 },
    { StudentID: '87369214', CourseID: 108, EnrollmentDate: '2023-09-15', Grade: 88 },
    { StudentID: '87369214', CourseID: 120, EnrollmentDate: '2024-01-10', Grade: 85 },
    { StudentID: '194DEF23', CourseID: 102, EnrollmentDate: '2023-09-02', Grade: 78 },
    { StudentID: '194DEF23', CourseID: 106, EnrollmentDate: '2024-07-05', Grade: 83 },
    { StudentID: '194DEF23', CourseID: 114, EnrollmentDate: '2023-09-20', Grade: 75 },
    { StudentID: '194DEF23', CourseID: 115, EnrollmentDate: '2024-02-05', Grade: 82 },
    { StudentID: '38741562', CourseID: 104, EnrollmentDate: '2023-09-03', Grade: 95 },
    { StudentID: '38741562', CourseID: 111, EnrollmentDate: '2023-09-10', Grade: 91 },
    { StudentID: '38741562', CourseID: 112, EnrollmentDate: '2024-01-15', Grade: 89 },
    { StudentID: '38741562', CourseID: 113, EnrollmentDate: '2024-02-20', Grade: 87 },
    { StudentID: '95718234', CourseID: 103, EnrollmentDate: '2024-06-20', Grade: 82 },
    { StudentID: '95718234', CourseID: 106, EnrollmentDate: '2024-07-01', Grade: 90 },
    { StudentID: '95718234', CourseID: 108, EnrollmentDate: '2023-09-12', Grade: 79 },
    { StudentID: '95718234', CourseID: 109, EnrollmentDate: '2024-01-08', Grade: 84 },
    { StudentID: '21394GHI', CourseID: 102, EnrollmentDate: '2023-09-05', Grade: 74 },
    { StudentID: '21394GHI', CourseID: 114, EnrollmentDate: '2023-09-18', Grade: 68 },
    { StudentID: '21394GHI', CourseID: 115, EnrollmentDate: '2024-02-12', Grade: 72 },
    { StudentID: '48273916', CourseID: 101, EnrollmentDate: '2023-09-01', Grade: 96 },
    { StudentID: '48273916', CourseID: 104, EnrollmentDate: '2023-09-05', Grade: 88 },
    { StudentID: '48273916', CourseID: 108, EnrollmentDate: '2023-09-20', Grade: 92 },
    { StudentID: '48273916', CourseID: 109, EnrollmentDate: '2024-01-10', Grade: 90 },
    { StudentID: '48273916', CourseID: 120, EnrollmentDate: '2024-02-15', Grade: 87 },
    { StudentID: '63918472', CourseID: 103, EnrollmentDate: '2024-07-15', Grade: 67 },
    { StudentID: '63918472', CourseID: 114, EnrollmentDate: '2023-09-15', Grade: 71 },
    { StudentID: '63918472', CourseID: 115, EnrollmentDate: '2024-02-08', Grade: 65 },
    { StudentID: '75193486', CourseID: 101, EnrollmentDate: '2023-09-01', Grade: 98 },
    { StudentID: '75193486', CourseID: 106, EnrollmentDate: '2024-06-12', Grade: 94 },
    { StudentID: '75193486', CourseID: 108, EnrollmentDate: '2023-09-18', Grade: 96 },
    { StudentID: '75193486', CourseID: 109, EnrollmentDate: '2024-01-12', Grade: 95 },
    { StudentID: '75193486', CourseID: 110, EnrollmentDate: '2024-02-20', Grade: 93 },
    { StudentID: '28471639', CourseID: 101, EnrollmentDate: '2023-09-02', Grade: 85 },
    { StudentID: '28471639', CourseID: 104, EnrollmentDate: '2023-09-06', Grade: 78 },
    { StudentID: '28471639', CourseID: 106, EnrollmentDate: '2024-06-15', Grade: 81 },
    { StudentID: '28471639', CourseID: 108, EnrollmentDate: '2023-09-22', Grade: 83 },
    { StudentID: '56782941', CourseID: 102, EnrollmentDate: '2023-09-03', Grade: 80 },
    { StudentID: '56782941', CourseID: 114, EnrollmentDate: '2023-09-22', Grade: 76 },
    { StudentID: '56782941', CourseID: 115, EnrollmentDate: '2024-02-10', Grade: 79 },
    { StudentID: '39284756', CourseID: 103, EnrollmentDate: '2024-06-22', Grade: 88 },
    { StudentID: '39284756', CourseID: 114, EnrollmentDate: '2023-09-25', Grade: 82 },
    { StudentID: '39284756', CourseID: 115, EnrollmentDate: '2024-02-15', Grade: 85 },
    { StudentID: '64829173', CourseID: 105, EnrollmentDate: '2023-09-08', Grade: 90 },
    { StudentID: '64829173', CourseID: 116, EnrollmentDate: '2023-09-28', Grade: 87 },
    { StudentID: '64829173', CourseID: 117, EnrollmentDate: '2024-01-18', Grade: 89 },
    { StudentID: '64829173', CourseID: 118, EnrollmentDate: '2024-02-25', Grade: 86 },
    { StudentID: '71938462', CourseID: 105, EnrollmentDate: '2023-09-10', Grade: 92 },
    { StudentID: '71938462', CourseID: 116, EnrollmentDate: '2023-10-02', Grade: 88 },
    { StudentID: '71938462', CourseID: 117, EnrollmentDate: '2024-01-20', Grade: 91 },
    { StudentID: '83572914', CourseID: 104, EnrollmentDate: '2023-09-04', Grade: 94 },
    { StudentID: '83572914', CourseID: 111, EnrollmentDate: '2023-09-12', Grade: 90 },
    { StudentID: '83572914', CourseID: 112, EnrollmentDate: '2024-01-18', Grade: 92 },
    { StudentID: '83572914', CourseID: 113, EnrollmentDate: '2024-02-22', Grade: 89 },
    { StudentID: '46281937', CourseID: 105, EnrollmentDate: '2023-09-12', Grade: 86 },
    { StudentID: '46281937', CourseID: 116, EnrollmentDate: '2023-10-05', Grade: 83 },
    { StudentID: '46281937', CourseID: 117, EnrollmentDate: '2024-01-22', Grade: 85 },
    { StudentID: '92738461', CourseID: 101, EnrollmentDate: '2023-09-03', Grade: 91 },
    { StudentID: '92738461', CourseID: 106, EnrollmentDate: '2024-06-18', Grade: 88 },
    { StudentID: '92738461', CourseID: 108, EnrollmentDate: '2023-09-25', Grade: 89 },
    { StudentID: '92738461', CourseID: 121, EnrollmentDate: '2024-01-15', Grade: 87 },
    { StudentID: '18374629', CourseID: 104, EnrollmentDate: '2023-09-07', Grade: 82 },
    { StudentID: '18374629', CourseID: 111, EnrollmentDate: '2023-09-15', Grade: 79 },
    { StudentID: '18374629', CourseID: 112, EnrollmentDate: '2024-01-20', Grade: 81 },
    { StudentID: '18374629', CourseID: 119, EnrollmentDate: '2024-02-28', Grade: 77 },
    { StudentID: '74938216', CourseID: 102, EnrollmentDate: '2023-09-06', Grade: 75 },
    { StudentID: '74938216', CourseID: 114, EnrollmentDate: '2023-09-28', Grade: 72 },
    { StudentID: '52839174', CourseID: 103, EnrollmentDate: '2024-06-25', Grade: 84 },
    { StudentID: '52839174', CourseID: 115, EnrollmentDate: '2024-02-18', Grade: 80 },
    { StudentID: '69482735', CourseID: 105, EnrollmentDate: '2023-09-14', Grade: 88 },
    { StudentID: '69482735', CourseID: 116, EnrollmentDate: '2023-10-08', Grade: 85 },
    { StudentID: '69482735', CourseID: 118, EnrollmentDate: '2024-03-02', Grade: 82 },
    { StudentID: '37192846', CourseID: 101, EnrollmentDate: '2023-09-04', Grade: 89 },
    { StudentID: '37192846', CourseID: 108, EnrollmentDate: '2023-09-28', Grade: 86 },
    { StudentID: '37192846', CourseID: 109, EnrollmentDate: '2024-01-18', Grade: 88 },
    { StudentID: '37192846', CourseID: 120, EnrollmentDate: '2024-02-22', Grade: 85 },
    { StudentID: '85629374', CourseID: 106, EnrollmentDate: '2024-06-20', Grade: 91 },
    { StudentID: '85629374', CourseID: 108, EnrollmentDate: '2023-10-02', Grade: 88 },
    { StudentID: '85629374', CourseID: 110, EnrollmentDate: '2024-02-25', Grade: 90 },
    { StudentID: '85629374', CourseID: 121, EnrollmentDate: '2024-01-20', Grade: 87 },
    { StudentID: '42918376', CourseID: 104, EnrollmentDate: '2023-09-08', Grade: 93 },
    { StudentID: '42918376', CourseID: 111, EnrollmentDate: '2023-09-18', Grade: 90 },
    { StudentID: '42918376', CourseID: 112, EnrollmentDate: '2024-01-22', Grade: 92 },
    { StudentID: '42918376', CourseID: 113, EnrollmentDate: '2024-03-05', Grade: 89 },
    { StudentID: '71829463', CourseID: 102, EnrollmentDate: '2023-09-07', Grade: 77 },
    { StudentID: '71829463', CourseID: 114, EnrollmentDate: '2023-10-05', Grade: 74 },
    { StudentID: '56372819', CourseID: 101, EnrollmentDate: '2023-09-05', Grade: 87 },
    { StudentID: '56372819', CourseID: 108, EnrollmentDate: '2023-10-08', Grade: 84 },
    { StudentID: '56372819', CourseID: 109, EnrollmentDate: '2024-01-22', Grade: 86 },
    { StudentID: '56372819', CourseID: 122, EnrollmentDate: '2024-02-28', Grade: 83 },
    { StudentID: '84729163', CourseID: 103, EnrollmentDate: '2024-06-28', Grade: 86 },
    { StudentID: '84729163', CourseID: 115, EnrollmentDate: '2024-02-20', Grade: 82 },
    { StudentID: '39281746', CourseID: 105, EnrollmentDate: '2023-09-16', Grade: 91 },
    { StudentID: '39281746', CourseID: 116, EnrollmentDate: '2023-10-10', Grade: 88 },
    { StudentID: '39281746', CourseID: 117, EnrollmentDate: '2024-01-25', Grade: 90 },
    { StudentID: '62839471', CourseID: 104, EnrollmentDate: '2023-09-09', Grade: 96 },
    { StudentID: '62839471', CourseID: 111, EnrollmentDate: '2023-09-20', Grade: 93 },
    { StudentID: '62839471', CourseID: 112, EnrollmentDate: '2024-01-25', Grade: 95 },
    { StudentID: '62839471', CourseID: 119, EnrollmentDate: '2024-03-08', Grade: 92 },
    { StudentID: '17483926', CourseID: 106, EnrollmentDate: '2024-06-22', Grade: 89 },
    { StudentID: '17483926', CourseID: 110, EnrollmentDate: '2024-02-28', Grade: 87 },
    { StudentID: '17483926', CourseID: 121, EnrollmentDate: '2024-01-22', Grade: 85 },
    { StudentID: '73928461', CourseID: 101, EnrollmentDate: '2023-09-06', Grade: 90 },
    { StudentID: '73928461', CourseID: 108, EnrollmentDate: '2023-10-10', Grade: 87 },
    { StudentID: '73928461', CourseID: 120, EnrollmentDate: '2024-03-02', Grade: 88 },
    { StudentID: '48572913', CourseID: 102, EnrollmentDate: '2023-09-08', Grade: 79 },
    { StudentID: '48572913', CourseID: 114, EnrollmentDate: '2023-10-12', Grade: 76 },
    { StudentID: '61938472', CourseID: 103, EnrollmentDate: '2024-07-01', Grade: 83 },
    { StudentID: '61938472', CourseID: 115, EnrollmentDate: '2024-02-22', Grade: 79 },
    { StudentID: '82739164', CourseID: 105, EnrollmentDate: '2023-09-18', Grade: 89 },
    { StudentID: '82739164', CourseID: 116, EnrollmentDate: '2023-10-15', Grade: 86 },
    { StudentID: '82739164', CourseID: 118, EnrollmentDate: '2024-03-05', Grade: 84 },
    { StudentID: '39482715', CourseID: 104, EnrollmentDate: '2023-09-10', Grade: 97 },
    { StudentID: '39482715', CourseID: 111, EnrollmentDate: '2023-09-22', Grade: 94 },
    { StudentID: '39482715', CourseID: 112, EnrollmentDate: '2024-01-28', Grade: 96 },
    { StudentID: '72839461', CourseID: 106, EnrollmentDate: '2024-06-25', Grade: 92 },
    { StudentID: '72839461', CourseID: 109, EnrollmentDate: '2024-01-25', Grade: 90 },
    { StudentID: '72839461', CourseID: 110, EnrollmentDate: '2024-03-08', Grade: 88 },
    { StudentID: '56381947', CourseID: 101, EnrollmentDate: '2023-09-07', Grade: 88 },
    { StudentID: '56381947', CourseID: 108, EnrollmentDate: '2023-10-12', Grade: 85 },
    { StudentID: '56381947', CourseID: 109, EnrollmentDate: '2024-01-28', Grade: 87 },
    { StudentID: '81937462', CourseID: 102, EnrollmentDate: '2023-09-09', Grade: 81 },
    { StudentID: '81937462', CourseID: 114, EnrollmentDate: '2023-10-15', Grade: 78 },
    { StudentID: '47283916', CourseID: 103, EnrollmentDate: '2024-07-03', Grade: 85 },
    { StudentID: '47283916', CourseID: 115, EnrollmentDate: '2024-02-25', Grade: 81 },
    { StudentID: '63829174', CourseID: 105, EnrollmentDate: '2023-09-20', Grade: 90 },
    { StudentID: '63829174', CourseID: 116, EnrollmentDate: '2023-10-18', Grade: 87 },
    { StudentID: '63829174', CourseID: 117, EnrollmentDate: '2024-01-30', Grade: 89 },
    { StudentID: '72938416', CourseID: 104, EnrollmentDate: '2023-09-11', Grade: 95 },
    { StudentID: '72938416', CourseID: 111, EnrollmentDate: '2023-09-25', Grade: 92 },
    { StudentID: '72938416', CourseID: 112, EnrollmentDate: '2024-02-02', Grade: 94 },
    { StudentID: '38472961', CourseID: 106, EnrollmentDate: '2024-06-28', Grade: 93 },
    { StudentID: '38472961', CourseID: 110, EnrollmentDate: '2024-03-10', Grade: 91 },
    { StudentID: '38472961', CourseID: 121, EnrollmentDate: '2024-01-28', Grade: 89 },
    { StudentID: '59183746', CourseID: 101, EnrollmentDate: '2023-09-08', Grade: 86 },
    { StudentID: '59183746', CourseID: 108, EnrollmentDate: '2023-10-15', Grade: 83 },
    { StudentID: '59183746', CourseID: 122, EnrollmentDate: '2024-03-05', Grade: 80 },
  ],
};

/**
 * Generate a deterministic random number generator from a seed string
 */
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  let value = Math.abs(hash);
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

/**
 * Get the row count for a table (15-20 rows)
 */
function getRowCount(seed: string, tableName: string): number {
  const rng = seedrandom(`${seed}-${tableName}`);
  return 15 + Math.floor(rng() * 6); // 15-20 inclusive
}

/**
 * Generate a random subset of data using a seeded random number generator
 */
export function generateRandomSubset<T>(fullData: T[], count: number, seed: string): T[] {
  const rng = seedrandom(seed);
  const shuffled = [...fullData].sort(() => rng() - 0.5);
  return shuffled.slice(0, Math.min(count, fullData.length));
}

/**
 * Assign student-specific table data for Exercise 3
 * This function generates a deterministic random subset of data for each student
 */
export function assignStudentTableData(
  studentId: string,
  homeworkSetId: string
): Record<string, any[]> {
  const seed = `${studentId}-${homeworkSetId}`;
  
  // Get row counts for each table
  const studentsCount = getRowCount(seed, 'Students');
  const coursesCount = getRowCount(seed, 'Courses');
  const lecturersCount = getRowCount(seed, 'Lecturers');
  const enrollmentsCount = getRowCount(seed, 'Enrollments');
  
  // Generate subsets
  const students = generateRandomSubset(EXERCISE3_FULL_DATASET.Students, studentsCount, `${seed}-Students`);
  const courses = generateRandomSubset(EXERCISE3_FULL_DATASET.Courses, coursesCount, `${seed}-Courses`);
  const lecturers = generateRandomSubset(EXERCISE3_FULL_DATASET.Lecturers, lecturersCount, `${seed}-Lecturers`);
  
  // For enrollments, we need to filter to only include enrollments for the selected students and courses
  const studentIds = new Set(students.map(s => s.StudentID));
  const courseIds = new Set(courses.map(c => c.CourseID));
  
  const validEnrollments = EXERCISE3_FULL_DATASET.Enrollments.filter(
    e => studentIds.has(e.StudentID) && courseIds.has(e.CourseID)
  );
  
  // If we have enough valid enrollments, use a subset; otherwise use all valid ones
  const enrollments = validEnrollments.length > enrollmentsCount
    ? generateRandomSubset(validEnrollments, enrollmentsCount, `${seed}-Enrollments`)
    : validEnrollments;
  
  return {
    Students: students,
    Courses: courses,
    Lecturers: lecturers,
    Enrollments: enrollments,
  };
}

/**
 * Initialize alasql with student-specific data
 */
export function initializeStudentSpecificData(alasql: any, studentTableData: Record<string, any[]>): void {
  // Clear any existing data
  alasql('DROP TABLE IF EXISTS Students');
  alasql('DROP TABLE IF EXISTS Courses');
  alasql('DROP TABLE IF EXISTS Lecturers');
  alasql('DROP TABLE IF EXISTS Enrollments');
  
  // Create tables
  alasql(`
    CREATE TABLE Students (
      StudentID TEXT PRIMARY KEY,
      FirstName TEXT,
      LastName TEXT,
      BirthDate TEXT,
      City TEXT,
      Email TEXT
    );
  `);
  
  alasql(`
    CREATE TABLE Courses (
      CourseID INTEGER PRIMARY KEY,
      CourseName TEXT,
      Credits INTEGER,
      Department TEXT
    );
  `);
  
  alasql(`
    CREATE TABLE Lecturers (
      LecturerID TEXT PRIMARY KEY,
      FirstName TEXT,
      LastName TEXT,
      City TEXT,
      HireDate TEXT,
      CourseID INTEGER,
      Seniority TEXT
    );
  `);
  
  alasql(`
    CREATE TABLE Enrollments (
      StudentID TEXT,
      CourseID INTEGER,
      EnrollmentDate TEXT,
      Grade INTEGER,
      PRIMARY KEY (StudentID, CourseID)
    );
  `);
  
  // Insert student-specific data
  if (studentTableData.Students && studentTableData.Students.length > 0) {
    studentTableData.Students.forEach((student: any) => {
      alasql('INSERT INTO Students VALUES (?, ?, ?, ?, ?, ?)', [
        student.StudentID,
        student.FirstName,
        student.LastName,
        student.BirthDate,
        student.City,
        student.Email,
      ]);
    });
  }
  
  if (studentTableData.Courses && studentTableData.Courses.length > 0) {
    studentTableData.Courses.forEach((course: any) => {
      alasql('INSERT INTO Courses VALUES (?, ?, ?, ?)', [
        course.CourseID,
        course.CourseName,
        course.Credits,
        course.Department,
      ]);
    });
  }
  
  if (studentTableData.Lecturers && studentTableData.Lecturers.length > 0) {
    studentTableData.Lecturers.forEach((lecturer: any) => {
      alasql('INSERT INTO Lecturers VALUES (?, ?, ?, ?, ?, ?, ?)', [
        lecturer.LecturerID,
        lecturer.FirstName,
        lecturer.LastName,
        lecturer.City,
        lecturer.HireDate,
        lecturer.CourseID,
        lecturer.Seniority,
      ]);
    });
  }
  
  if (studentTableData.Enrollments && studentTableData.Enrollments.length > 0) {
    studentTableData.Enrollments.forEach((enrollment: any) => {
      alasql('INSERT INTO Enrollments VALUES (?, ?, ?, ?)', [
        enrollment.StudentID,
        enrollment.CourseID,
        enrollment.EnrollmentDate,
        enrollment.Grade,
      ]);
    });
  }
  
  console.log('✅ Initialized student-specific Exercise 3 data:', {
    Students: studentTableData.Students?.length || 0,
    Courses: studentTableData.Courses?.length || 0,
    Lecturers: studentTableData.Lecturers?.length || 0,
    Enrollments: studentTableData.Enrollments?.length || 0,
  });
}

