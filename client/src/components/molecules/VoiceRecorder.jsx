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
    const streamRef = useRef(null);

    // Determine best supported MIME type
    const getMimeType = () => {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
            'audio/ogg',
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return 'audio/webm'; // Default fallback
    };

    useEffect(() => {
        startRecording();
        return () => {
            stopRecordingContext();
        };
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });
            streamRef.current = stream;

            const mimeType = getMimeType();
            console.log('Using MIME type:', mimeType);

            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.onerror = (e) => {
                console.error('MediaRecorder error:', e);
                alert('Recording error occurred');
                onCancel();
            };

            // Start with 1 second timeslice to ensure data is captured periodically
            mediaRecorderRef.current.start(1000);
            setIsRecording(true);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Error accessing microphone:", err);
            if (err.name === 'NotAllowedError') {
                alert("Microphone access denied. Please allow microphone in browser settings.");
            } else if (err.name === 'NotFoundError') {
                alert("No microphone found on this device.");
            } else {
                alert("Could not access microphone: " + err.message);
            }
            onCancel();
        }
    };

    const stopRecordingContext = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
                mediaRecorderRef.current.stop();
            } catch (e) {
                console.warn('Error stopping recorder:', e);
            }
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const handleSend = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            console.warn('Recorder not active');
            return;
        }

        // Clear the timer first
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        // Set up onstop handler before stopping
        mediaRecorderRef.current.onstop = () => {
            if (chunksRef.current.length === 0) {
                console.warn("No audio chunks recorded");
                alert("Recording failed - no audio captured. Try again.");
                onCancel();
                return;
            }

            const mimeType = getMimeType();
            const blob = new Blob(chunksRef.current, { type: mimeType });
            console.log('Audio blob created:', blob.size, 'bytes');

            if (blob.size < 1000) {
                console.warn("Audio too short");
                alert("Recording too short. Please record for longer.");
                onCancel();
                return;
            }

            onSend(blob);
        };

        // Request any pending data, then stop
        if (mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.requestData(); // Flush any pending data
            mediaRecorderRef.current.stop();
        }

        // Stop all tracks to release microphone
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
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
