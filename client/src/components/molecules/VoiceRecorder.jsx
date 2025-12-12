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
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const handleSend = () => {
        if (!mediaRecorderRef.current) return;

        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            onSend(blob);
        };
        stopRecordingContext();
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
