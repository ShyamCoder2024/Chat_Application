import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send } from 'lucide-react';
import Button from '../atoms/Button';
import './VoiceRecorder.css';

const VoiceRecorder = ({ onSend, onCancel }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    useEffect(() => {
        startRecording();
        return () => {
            stopRecordingContext();
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone.");
            onCancel();
        }
    };

    const stopRecordingContext = () => {
        if (mediaRecorderRef.current) {
            if (mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            if (mediaRecorderRef.current.stream) {
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            }
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const handleSend = () => {
        if (!mediaRecorderRef.current) return;

        // Securely bind onstop before stopping
        mediaRecorderRef.current.onstop = () => {
            if (chunksRef.current.length === 0) {
                console.warn("No audio chunks recorded");
                return;
            }
            // Explicitly use audio/webm; codecs=opus for broad compatibility
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            onSend(blob);
        };

        // Stop the recorder to trigger onstop
        if (mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }

        // Stop all tracks to release the microphone
        if (mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="voice-recorder">
            <div className="recording-indicator">
                <div className="recording-dot"></div>
                <span className="recording-time">{formatTime(recordingTime)}</span>
            </div>
            <div className="recorder-actions">
                <Button variant="secondary" size="icon" onClick={onCancel} className="cancel-btn">
                    <Trash2 size={20} color="#ff4444" />
                </Button>
                <Button variant="primary" size="icon" onClick={handleSend} className="send-audio-btn">
                    <Send size={20} />
                </Button>
            </div>
        </div>
    );
};

export default VoiceRecorder;
