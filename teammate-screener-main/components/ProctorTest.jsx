"use client";
import { useEffect, useState, useRef } from "react";
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

// Dynamic Questions based on the requested skill
const questionBank = {
  "Python": { q: "Which of the following data types is immutable in Python?", options: ["List", "Dictionary", "Tuple", "Set"], ans: "Tuple" },
  "React / Next.js": { q: "Which hook is used to perform side effects in a functional component?", options: ["useState", "useEffect", "useContext", "useReducer"], ans: "useEffect" },
  "C++": { q: "Which concept allows a class to derive properties from another class?", options: ["Polymorphism", "Encapsulation", "Inheritance", "Abstraction"], ans: "Inheritance" },
  "DBMS / SQL": { q: "Which SQL command is used to remove a table entirely from a database?", options: ["DELETE", "REMOVE", "TRUNCATE", "DROP"], ans: "DROP" },
  "Default": { q: "Which data structure operates on a Last In, First Out (LIFO) principle?", options: ["Queue", "Stack", "Tree", "Graph"], ans: "Stack" }
};

export default function ProctorTest({ teammate, onTestComplete }) {
  const [isTestActive, setIsTestActive] = useState(false);
  const [testFailed, setTestFailed] = useState(false);
  const [failReason, setFailReason] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [modelLoaded, setModelLoaded] = useState(false);

  const cameraRef = useRef(null);
  const screenRef = useRef(null);
  const camStreamRef = useRef(null);
  const scrStreamRef = useRef(null);
  const modelRef = useRef(null);
  const detectionIntervalRef = useRef(null);

  const testQuestion = questionBank[teammate.skill] || questionBank["Default"];

  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        const loadedModel = await cocoSsd.load();
        modelRef.current = loadedModel;
        setModelLoaded(true);
      } catch (err) {
        console.error("AI Model failed to load", err);
      }
    };
    loadModel();
  }, []);

  const stopAllStreams = () => {
    if (camStreamRef.current) camStreamRef.current.getTracks().forEach(t => t.stop());
    if (scrStreamRef.current) scrStreamRef.current.getTracks().forEach(t => t.stop());
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
  };

  const startAIDetection = () => {
    detectionIntervalRef.current = setInterval(async () => {
      if (cameraRef.current && modelRef.current && cameraRef.current.readyState === 4) {
        const predictions = await modelRef.current.detect(cameraRef.current);
        let personCount = 0;
        let phoneDetected = false;

        predictions.forEach(prediction => {
          if (prediction.class === "person") personCount++;
          if (prediction.class === "cell phone") phoneDetected = true;
        });

        if (phoneDetected) {
          triggerFail("AI Detected Malpractice (Mobile Phone).");
        } else if (personCount > 1) {
          triggerFail("AI Detected Multiple Faces.");
        }
      }
    }, 1000);
  };

  const triggerFail = (reason) => {
    setTestFailed(true);
    setFailReason(`${reason} Auto-Score: 0%`);
    stopAllStreams();
  };

  const startProctoring = async () => {
    if (!modelLoaded) return alert("Please wait for AI to load.");
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const scrStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "monitor" } });

      camStreamRef.current = camStream;
      scrStreamRef.current = scrStream;
      setIsTestActive(true);

      setTimeout(() => {
        if (cameraRef.current) cameraRef.current.srcObject = camStream;
        if (screenRef.current) screenRef.current.srcObject = scrStream;
        startAIDetection();
      }, 100);
    } catch (err) {
      alert("Camera and Entire Screen Sharing required.");
    }
  };

  // STRICT ANTI-CHEAT (Triggers only when test is actively running)
  useEffect(() => {
    if (!isTestActive || testFailed) return;

    const onBlur = () => triggerFail("Window lost focus (You clicked outside the test tab)!");
    const onVisibilityChange = () => { if (document.hidden) triggerFail("Tab switching detected!"); };
    const onContextMenu = (e) => { e.preventDefault(); };
    const onCopyPaste = (e) => { e.preventDefault(); triggerFail("Copy/Paste is strictly prohibited!"); };

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopyPaste);
    document.addEventListener("paste", onCopyPaste);

    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopyPaste);
      document.removeEventListener("paste", onCopyPaste);
    };
  }, [isTestActive, testFailed]);

  const handleSubmit = async () => {
    if (!selectedAnswer) return alert("Please select an answer.");
    stopAllStreams();
    const finalScore = selectedAnswer === testQuestion.ans ? 90 : 40;
    onTestComplete(finalScore);
  };

  if (testFailed) {
    return (
      <div className="w-full max-w-2xl mx-auto mt-10 bg-red-50 border-2 border-red-500 p-10 rounded-xl text-center shadow-lg">
        <h1 className="text-4xl font-bold text-red-700 mb-4">TEST FAILED</h1>
        <p className="text-lg text-red-900 font-semibold mb-6">{failReason}</p>
        <button onClick={() => onTestComplete(0)} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold">Return Score (0%) to Requester</button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto mt-2">
      {!isTestActive ? (
        <div className="text-center bg-white p-10 rounded-xl shadow-md border max-w-2xl mx-auto">
          <h3 className="text-2xl font-bold mb-4">{teammate.name}&apos;s Assessment</h3>
          <p className="mb-6 font-semibold text-blue-600">Testing Skill: {teammate.skill}</p>
          <div className="text-left bg-gray-50 border p-4 rounded-lg mb-6 text-sm text-gray-700">
            <p className="font-bold mb-2">Rules (Strictly Enforced):</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Do not switch tabs or click outside the window.</li>
              <li>No right-clicking, copying, or pasting.</li>
              <li>Your camera and screen are monitored by AI. Mobile phones are forbidden.</li>
            </ul>
          </div>
          {modelLoaded ? (
            <button onClick={startProctoring} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold shadow-md hover:bg-blue-700">Accept Rules & Start Test</button>
          ) : (
            <p className="text-orange-600 font-bold animate-pulse">Loading Anti-Cheat AI Models...</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-3 bg-white p-8 rounded-lg shadow-md border select-none">
            <h2 className="text-2xl font-bold mb-6">Technical Question</h2>
            <div className="p-4 border rounded-lg bg-gray-50 mb-6">
              <p className="font-semibold mb-4 text-lg">{testQuestion.q}</p>
              <div className="space-y-3">
                {testQuestion.options.map((opt, idx) => (
                  <label key={idx} className="block p-4 border rounded-lg hover:bg-white cursor-pointer transition">
                    <input type="radio" name="q" value={opt} onChange={(e) => setSelectedAnswer(e.target.value)} className="mr-3 scale-125"/>
                    {opt}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={handleSubmit} className="bg-green-600 text-white px-8 py-4 rounded-lg font-bold w-full hover:bg-green-700 transition shadow-md">Submit Answer</button>
          </div>
          <div className="col-span-1 space-y-4">
            <div className="bg-black rounded-lg h-36 relative border border-gray-800 shadow-inner">
              <video ref={cameraRef} autoPlay playsInline muted className="w-full h-full object-cover rounded-lg" />
              <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded animate-pulse font-bold">REC</div>
            </div>
            <div className="bg-black rounded-lg h-36 relative border border-gray-800 shadow-inner">
              <video ref={screenRef} autoPlay playsInline muted className="w-full h-full object-cover rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}