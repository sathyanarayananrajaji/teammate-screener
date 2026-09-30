'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';

// Firebase Imports (Replace config with your real Firebase project keys)
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
};
// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);
// const provider = new GoogleAuthProvider();

const questions = [
  { id: 1, question: "What is the output of type(10) in Python?", options: ["int", "float", "str", "bool"], answer: "int" },
  { id: 2, question: "Which keyword is used to define a function in Python?", options: ["func", "define", "def", "function"], answer: "def" },
  { id: 3, question: "Which of the following data types is immutable?", options: ["list", "dict", "set", "tuple"], answer: "tuple" },
  { id: 4, question: "What is the correct file extension for Python files?", options: [".pt", ".pyt", ".py", ".python"], answer: ".py" },
  { id: 5, question: "Which symbol is used for single-line comments in Python?", options: ["//", "#", "/*", "<!--"], answer: "#" },
  { id: 6, question: "Which function is used to get the length of a list in Python?", options: ["size()", "length()", "len()", "count()"], answer: "len()" },
  { id: 7, question: "What does bool(0) evaluate to in Python?", options: ["True", "False", "None", "Error"], answer: "False" },
  { id: 8, question: "Which operator is used for exponentiation (power) in Python?", options: ["^", "**", "//", "%"], answer: "**" },
  { id: 9, question: "What is the output of 2 ** 3?", options: ["6", "8", "9", "12"], answer: "8" },
  { id: 10, question: "Which method converts a string to uppercase in Python?", options: ["upper()", "toUpperCase()", "UPPER()", "capitalize()"], answer: "upper()" },
  { id: 11, question: "How do you create an empty set in Python?", options: ["{}", "set()", "[]", "empty_set()"], answer: "set()" },
  { id: 12, question: "Which built-in module handles date and time operations?", options: ["time", "calendar", "datetime", "date"], answer: "datetime" },
  { id: 13, question: "What is an anonymous function in Python called?", options: ["def function", "lambda", "macro", "eval"], answer: "lambda" },
  { id: 14, question: "Which keyword is used to handle exceptions in Python?", options: ["try", "catch", "handle", "except_error"], answer: "try" },
  { id: 15, question: "How do you open a file for reading in Python?", options: ["open('file', 'r')", "read('file')", "file.open()", "io.open('r')"], answer: "open('file', 'r')" },
  { id: 16, question: "Which function checks if an object is an instance of a class?", options: ["type_of()", "isinstance()", "check_class()", "instance()"], answer: "isinstance()" },
  { id: 17, question: "What is the result of 10 // 3 in Python?", options: ["3.33", "3", "4", "3.0"], answer: "3" },
  { id: 18, question: "Which keyword is used to exit a loop prematurely?", options: ["stop", "exit", "break", "halt"], answer: "break" },
  { id: 19, question: "What is the default value of start in range(start, stop, step)?", options: ["1", "0", "-1", "None"], answer: "0" },
  { id: 20, question: "Which of the following is not a keyword in Python?", options: ["eval", "pass", "assert", "nonlocal"], answer: "eval" }
];

export default function Page() {
  const [step, setStep] = useState('profile');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [skill, setSkill] = useState('Python');
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [savedResults, setSavedResults] = useState([]);

  // Proctoring States
  const videoRef = useRef(null);
  const proctorInterval = useRef(null);
  const missingCount = useRef(0);
  const [isTerminated, setIsTerminated] = useState(false);
  const [proctorStatus, setProctorStatus] = useState('');

  useEffect(() => {
    const existing = JSON.parse(localStorage.getItem('local_results') || '[]');
    setSavedResults(existing);
    return () => stopProctoring(); // Cleanup on unmount
  }, []);

  // ====== 1. GOOGLE AUTHENTICATION & DUPLICATE CHECK ======
  const handleGoogleLogin = async () => {
    try {
      // NOTE: For live presentation, if Firebase isn't configured, we use a mock prompt. 
      // Replace this block with actual `signInWithPopup(auth, provider)` once configured.
      const mockEmail = prompt("Google Auth Simulation: Enter your email to sign in");
      if (!mockEmail) return;

      // Check if student already took the test
      const existing = JSON.parse(localStorage.getItem('local_results') || '[]');
      const hasTakenTest = existing.some(result => result.studentEmail === mockEmail);

      if (hasTakenTest) {
        alert("Authentication Failed: This email has already submitted an assessment.");
        return;
      }

      setStudentEmail(mockEmail);
      setStudentName(mockEmail.split('@')[0]); // Mock name extraction
      alert("Google Sign-In Successful!");
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  // ====== 2. AI FACE PROCTORING (TENSORFLOW) ======
  const startProctoring = async () => {
    try {
      setProctorStatus('Initializing AI Camera...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const model = await blazeface.load();
      setProctorStatus('AI Proctor Active (Monitoring Presence)');

      // Check for face every 2 seconds
      proctorInterval.current = setInterval(async () => {
        if (videoRef.current && videoRef.current.readyState === 4) {
          const predictions = await model.estimateFaces(videoRef.current, false);
          
          if (predictions.length === 0) {
            missingCount.current += 1;
            // If face is missing for 3 consecutive checks (6 seconds), terminate!
            if (missingCount.current >= 3) {
              terminateTest();
            }
          } else {
            missingCount.current = 0; // Reset if face returns
          }
        }
      }, 2000);
    } catch (err) {
      alert("Webcam permission denied. Camera is required for this assessment.");
    }
  };

  const stopProctoring = () => {
    if (proctorInterval.current) clearInterval(proctorInterval.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const terminateTest = () => {
    stopProctoring();
    setIsTerminated(true);
    setStep('terminated');
  };

  // ====== TEST FLOW LOGIC ======
  const startTest = () => {
    if (!studentEmail) {
      alert("Please log in with Google first.");
      return;
    }
    if (!department) return;
    
    // Check if mobile (to skip screen share)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      alert("Mobile Device Detected: Screen sharing is disabled by iOS/Android OS. Proceeding with Webcam Proctoring only.");
    }

    setStep('test');
    startProctoring();
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      calculateTestResults();
    }
  };

  const calculateTestResults = () => {
    stopProctoring();
    let correct = 0;
    questions.forEach((q) => {
      if (selectedAnswers[q.id] === q.answer) correct++;
    });

    const calculatedScore = (correct / questions.length) * 100;
    setScore(calculatedScore);
    setPassed(calculatedScore >= 85);
    setStep('results');
  };

  const handleSaveToDatabase = () => {
    const newRecord = {
      id: Date.now(),
      studentName,
      studentEmail,
      department,
      skill,
      score,
      passed,
      date: new Date().toLocaleString()
    };
    const updated = [newRecord, ...savedResults];
    localStorage.setItem('local_results', JSON.stringify(updated));
    setSavedResults(updated);
    alert("Score Saved Successfully to Local Database!");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      
      {/* STEP 1: PROFILE & LOGIN */}
      {step === 'profile' && (
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">Teammate Screener</h1>
          
          {!studentEmail ? (
            <button 
              onClick={handleGoogleLogin}
              className="w-full py-3 mb-6 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 shadow-sm"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
              Sign in with Google
            </button>
          ) : (
            <div className="mb-6 p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm text-center font-medium">
              Verified: {studentEmail}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select required value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">-- Select Department --</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Information Technology">Information Technology</option>
              </select>
            </div>
            <button onClick={startTest} className="w-full py-3 mt-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
              Start Proctored Assessment
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: TEST SCREEN WITH WEBCAM PROCTORING */}
      {step === 'test' && (
        <div className="w-full max-w-4xl flex flex-col md:flex-row gap-6">
          
          {/* Main Test Area */}
          <div className="flex-1 rounded-2xl bg-white p-8 shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b pb-3">
              <span className="text-sm font-semibold text-gray-500">Skill: {skill}</span>
              <span className="text-sm font-bold text-blue-600">Question {currentQuestionIndex + 1} of {questions.length}</span>
            </div>

            <h2 className="text-lg font-bold text-gray-800 mb-6">{questions[currentQuestionIndex].question}</h2>
            <div className="space-y-3 mb-8">
              {questions[currentQuestionIndex].options.map((option, idx) => {
                const qId = questions[currentQuestionIndex].id;
                const isSelected = selectedAnswers[qId] === option;
                return (
                  <button key={idx} onClick={() => setSelectedAnswers({ ...selectedAnswers, [qId]: option })}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition ${isSelected ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                    {option}
                  </button>
                );
              })}
            </div>

            <button onClick={handleNextQuestion} disabled={!selectedAnswers[questions[currentQuestionIndex].id]}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {currentQuestionIndex === questions.length - 1 ? "Submit Test" : "Next Question"}
            </button>
          </div>

          {/* AI Proctoring Sidebar */}
          <div className="w-full md:w-72 bg-white rounded-2xl p-4 shadow-xl flex flex-col items-center">
            <h3 className="text-sm font-bold text-gray-800 mb-2">AI Proctor Feed</h3>
            <p className="text-xs text-red-500 font-semibold mb-4 text-center animate-pulse">{proctorStatus}</p>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto rounded-lg bg-black mirror border border-gray-300" style={{ transform: "scaleX(-1)" }} />
            <p className="text-xs text-gray-500 mt-4 text-center">Looking away or leaving the frame will instantly terminate your test.</p>
          </div>
        </div>
      )}

      {/* STEP 3: TERMINATED STATE (ANTI-CHEAT) */}
      {step === 'terminated' && (
        <div className="w-full max-w-md rounded-2xl bg-red-50 border border-red-200 p-8 shadow-xl text-center">
          <h1 className="text-3xl font-extrabold text-red-600 mb-4">TEST TERMINATED</h1>
          <p className="text-gray-800 font-medium mb-2">A violation was detected.</p>
          <p className="text-sm text-gray-600 mb-6">Our AI proctoring system determined that you left the camera frame. This assessment has been invalidated.</p>
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700">
            Return to Home
          </button>
        </div>
      )}

      {/* STEP 4: RESULTS */}
      {step === 'results' && (
        <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-xl text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Assessment Results</h1>
          <p className="text-gray-600 mb-6"><span className="font-semibold">{studentEmail}</span></p>
          <div className="my-6"><span className={`text-6xl font-extrabold ${passed ? 'text-green-600' : 'text-red-600'}`}>{score}%</span></div>
          <button onClick={handleSaveToDatabase} className="w-full py-3 mt-4 bg-blue-600 text-white font-semibold rounded-lg">
            Save Results to Database
          </button>
        </div>
      )}
    </main>
  );
}