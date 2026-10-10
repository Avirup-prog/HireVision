import cv2
from deepface import DeepFace
import time

def main():
    print("Loading DeepFace Models... (This might take a few seconds on the very first run)")
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    
    if not cap.isOpened():
        print("CRITICAL ERROR: Could not open webcam.")
        return

    # Deepface uses heavy neural networks, so running it 30 times a second would freeze your PC.
    # Instead, we only run the heavy emotion calculation every 15 frames (about twice a second).
    frame_counter = 0
    analyze_every_n_frames = 15 
    
    current_emotion = "Detecting..."
    stress_level = "Calculating..."
    ui_color = (255, 255, 255)
    
    print("Webcam open! Make faces at the camera. Press 'q' to quit.")
    
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            continue
            
        frame = cv2.flip(frame, 1)
        frame_counter += 1
        
        # Trigger the AI Emotion Check every 15 frames
        if frame_counter % analyze_every_n_frames == 0:
            try:
                # enforce_detection=False prevents crashes if you turn your head too far away
                # We use detector_backend='mediapipe' to bypass the broken OpenCV Haar Cascade error
                analysis = DeepFace.analyze(frame, actions=['emotion'], enforce_detection=False, detector_backend='mediapipe')
                
                # DeepFace returns a list if it spots multiple faces in the background. We just take index 0.
                if isinstance(analysis, list):
                    analysis = analysis[0]
                    
                dominant_emotion = analysis['dominant_emotion']
                current_emotion = dominant_emotion.capitalize()
                
                # Map standard emotions to "HireVision Stress Levels"
                if dominant_emotion in ['fear', 'angry', 'sad', 'disgust']:
                    stress_level = "HIGH STRESS (Apex Phase)"
                    ui_color = (0, 0, 255) # Red
                elif dominant_emotion == 'neutral':
                    stress_level = "Baseline (Resting Phase)"
                    ui_color = (255, 255, 0) # Cyan/Yellow
                elif dominant_emotion in ['happy', 'surprise']:
                    stress_level = "Elevated / Engaged"
                    ui_color = (0, 255, 0) # Green
                    
            except Exception as e:
                # Print the error so we know why it's failing
                print(f"DeepFace Error: {e}")
                
        # Overlay the text on the video feed
        cv2.putText(frame, f"Emotion: {current_emotion}", (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        cv2.putText(frame, f"State: {stress_level}", (30, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.7, ui_color, 2)
        
        cv2.imshow('HireVision - Stress AI', frame)
        
        # We use waitKey(1) for a smooth 60fps webcam feed
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
            
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
