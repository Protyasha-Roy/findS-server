const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const { ObjectId } = require('mongodb');
require('dotenv').config();
const bcrypt = require('bcrypt');


const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(cors());
app.use(express.json());

// MongoDB connection
const mongoURI = process.env.mongoURI;

mongoose.connect(mongoURI);
const connection = mongoose.connection;
connection.once('open', () => {
  console.log('MongoDB database connection established successfully');
});

const usersCollection = connection.collection('users');
const studentsCollection = connection.collection('students');
const attendanceCollection = connection.collection('attendance');

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the email already exists in the collection
    const existingUser = await usersCollection.findOne({ email });

    if (existingUser) {
      // If email exists, check if the password matches
      const passwordMatch = await bcrypt.compare(password, existingUser.password);

      if (passwordMatch) {
        // If password matches, consider it as a signin
        res.status(200).json({ message: 'Login successful', userId: existingUser._id });
      } else {
        // If password doesn't match, return an error
        res.status(401).json({ message: 'Password did not match' });
      }
    } else {
      // If email doesn't exist, create a new user and consider it as a signup
      const _id = new ObjectId(); // Generate a new ObjectId
      const hashedPassword = await bcrypt.hash(password, 10);

      // Save the new user to the collection
      await usersCollection.insertOne({ _id, email, password: hashedPassword });

      res.status(200).json({ message: 'Signup successful', userId: _id });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.post('/add-student', async (req, res) => {
  try {
      const { name, roll, userId } = req.body;
      const existingStudent = await studentsCollection.findOne({ roll, userId });

      if (existingStudent) {
          // If student with the same roll and userId exists, return an error
          res.status(400).json({ message: 'Student with this roll already exists' });
      } else {
          // Otherwise, add the new student to the collection
          await studentsCollection.insertOne({ name, roll, userId });
          res.status(200).json({ message: 'Student added successfully' });
      }
  } catch (error) {
      console.error('Error adding new student:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/check-rolls', async (req, res) => {
    try {
        const rolls = req.body.rolls;
        const userId = req.body.userId;

        const mismatchedRolls = [];

        for (const roll of rolls) {
            const existingStudent = await studentsCollection.findOne({ roll, userId });
            if (!existingStudent) {
                mismatchedRolls.push(roll);
            }
        }

        res.json({ mismatchedRolls });
    } catch (error) {
        console.error('Error checking mismatched rolls:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.get('/get-students', async (req, res) => {
  try {
      const userId = req.query.userId;
      
      // Assuming you have a collection named 'students'
      const students = await studentsCollection.find({ userId }).toArray();

      res.status(200).json(students);
  } catch (error) {
      console.error('Error fetching students:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/delete-student', async (req, res) => {
  try {
      const { userId, roll } = req.body;
      // Assuming you have a collection named 'students'
      const result = await studentsCollection.deleteOne({ userId, roll });

      if (result.deletedCount === 0) {
          // If no student was deleted, return an error
          res.status(404).json({ error: 'Student not found for the given user' });
      } else {
          res.status(200).json({ message: 'Student deleted successfully' });
      }
  } catch (error) {
      console.error('Error deleting student:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/addAttendance', async (req, res) => {
  try {
      const { userId, rolls } = req.body;
      
      const totalStudentRolls = (await studentsCollection.find({userId}).toArray()).map(student => student.roll);
     
      const updatedRolls = rolls.filter(roll => totalStudentRolls.includes(roll) );
      const unmatchedRolls = rolls.filter(roll => !totalStudentRolls.includes(roll) );

    
      if(updatedRolls.length > 0) {
        const absentRolls = updatedRolls
        .filter(roll => !totalStudentRolls.includes(roll))
        .concat(totalStudentRolls.filter(roll => !updatedRolls.includes(roll)));
        


        const currentDate = new Date();
        const postingDate = `${currentDate.getDate()}-${currentDate.getMonth() + 1}-${currentDate.getFullYear()}`;

        // Save attendance record to the collection
        await attendanceCollection.insertOne({
            userId,
            date: postingDate,
            presentRolls: updatedRolls,
            absentRolls: absentRolls,
        });


        if(unmatchedRolls.length > 0) {
            res.status(200).json({ message: `Attendance added successfully, excluded rolls: ${unmatchedRolls}` });
        }
        else{
          res.status(200).json({ message: 'Attendance added successfully' });
        }

      }
      else {
        res.status(200).json({message: "Rolls don't exist"})
      }

  } catch (error) {
      console.error('Error adding attendance:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.get('/get-attendance', async (req, res) => {
  try {
    const userId = req.query.userId;

    // Assuming you have a collection named 'attendance'
    const attendanceData = await attendanceCollection.find({ userId }).toArray();

    res.status(200).json(attendanceData);
  } catch (error) {
    console.error('Error fetching attendance data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/delete-attendance', async (req, res) => {
  try {
    const userId = req.query.userId;
    const attendanceId = req.query.attendanceId;

    const result = await attendanceCollection.deleteOne({ userId, _id: new ObjectId(attendanceId) });

    if (result.deletedCount === 0) {
      // If no attendance record was deleted, return an error
      res.status(404).json({ error: 'Attendance record not found for the given user' });
    } else {
      res.status(200).json({ message: 'Attendance record deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting attendance record:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
