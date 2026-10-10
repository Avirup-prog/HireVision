import cv2
import mediapipe as mp
import numpy as np
import time

print("Initializing MediaPipe Models...")
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True, 
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

def get_gaze_ratio(eye_points, iris_center, frame_width):
    corner_left = np.array([eye_points[0].x * frame_width, eye_points[0].y])
    corner_right = np.array([eye_points[1].x * frame_width, eye_points[1].y])
    iris = np.array([iris_center.x * frame_width, iris_center.y])
    
    total_eye_width = np.linalg.norm(corner_right - corner_left)
    iris_distance_from_left = np.linalg.norm(iris - corner_left)
    
    if total_eye_width == 0:
        return 0.5
    return iris_distance_from_left / total_eye_width

def main():
    print("Attempting to open webcam (Index 0)...")
    # CAP_DSHOW forces Windows to use DirectShow, which fixes 90% of camera hanging issues
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    
    if not cap.isOpened():
        print("CRITICAL ERROR: Could not open the webcam. Please check if Zoom/Chrome is using it!")
        return
        
    print("Camera opened successfully! Launching window... Press 'q' to quit.")
    
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            print("Warning: Received empty frame. Retrying...")
            time.sleep(1)
            continue
            
        frame = cv2.flip(frame, 1)
        h, w, _ = frame.shape
        
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb_frame)
        
        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                left_eye_corners = [face_landmarks.landmark[33], face_landmarks.landmark[133]]
                left_iris = face_landmarks.landmark[468]
                right_eye_corners = [face_landmarks.landmark[362], face_landmarks.landmark[263]]
                right_iris = face_landmarks.landmark[473]
                
                left_ratio = get_gaze_ratio(left_eye_corners, left_iris, w)
                right_ratio = get_gaze_ratio(right_eye_corners, right_iris, w)
                avg_ratio = (left_ratio + right_ratio) / 2.0
                
                gaze_status = "Looking CENTER"
                color = (0, 255, 0)
                
                if avg_ratio < 0.40:
                    gaze_status = "Looking AWAY (Right) - POTENTIAL CHEATING"
                    color = (0, 0, 255)
                elif avg_ratio > 0.60:
                    gaze_status = "Looking AWAY (Left) - POTENTIAL CHEATING"
                    color = (0, 0, 255)
                    
                cv2.putText(frame, gaze_status, (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
                cv2.circle(frame, (int(left_iris.x * w), int(left_iris.y * h)), 3, (255, 0, 0), -1)
                cv2.circle(frame, (int(right_iris.x * w), int(right_iris.y * h)), 3, (255, 0, 0), -1)

        cv2.imshow('CogniScreen - Gaze Tracking (Press Q to quit)', frame)
        if cv2.waitKey(5) & 0xFF == ord('q'):
            break
            
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
