function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

let experimentData = {
  sessionId: generateSessionId(),
  timestamp: Date.now(),
  startTime: null,
  endTime: null,
  duration: null,
  
  
  screen: {
    width: screen.width,
    height: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    pixelRatio: window.devicePixelRatio,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  },
  
  tasks: [],
  currentTaskId: null,
  gazeData: [],
  emotionData: [],
  interactionEvents: [],
  errors: []
}

let timerInterval = null;
let isExperimentRunning = false;
window._gazeTarget = null;
let completedTaskIds = new Set();
let currentTaskPageUrl = null;

if (typeof document !== 'undefined') {
  const startBtn = document.getElementById('startBtn')
  const stopBtn = document.getElementById('stopBtn')
  const tasksBtn = document.getElementById('tasksBtn')
  const timerDisplay = document.getElementById('timer')
  const modal = document.getElementById('tasksModal')
  const closeBtn = document.querySelector('.close')


  const controlsDiv = document.querySelector('.controls');


  const experimentBtn = document.getElementById('experimentBtn');

  if (experimentBtn) {
    experimentBtn.disabled = true;                    
    experimentBtn.title = 'Сначала пройдите калибровку';
}

  if (tasksBtn) tasksBtn.disabled = true;

  experimentBtn.addEventListener('click', () => {
    if (!isExperimentRunning) {
      isExperimentRunning = true;
      experimentData.startTime = Date.now();
      experimentData.endTime = null;
      experimentData.duration = null;
      experimentData.gazeData = [];
      experimentData.emotionData = [];
      experimentData.sessionId = generateSessionId();
      experimentData.timestamp = Date.now();
      experimentData.tasks = [];
      experimentData.currentTaskId = null;
      experimentData.interactionEvents = [];
      experimentData.errors = [];
      experimentData.screen = {
        width: screen.width, height: screen.height,
        availWidth: screen.availWidth, availHeight: screen.availHeight,
        pixelRatio: window.devicePixelRatio,
        viewport: { width: window.innerWidth, height: window.innerHeight }
      };
      window._gazeTarget = experimentData.gazeData;
      const info = localStorage.getItem('participantInfo');
      if (info) {
        try {
          const parsed = JSON.parse(info);
          experimentData.participantNumber = parsed.participantNumber;
          experimentData.group = parsed.group || 'A';
          experimentData.glasses = parsed.glasses;
          experimentData.consentData = parsed.consentData;
          experimentData.consentExperiment = parsed.consentExperiment;
        } catch (e) {}
      }
      experimentBtn.textContent = 'Завершить';
      experimentBtn.classList.add('btn-stop');
      experimentBtn.classList.remove('btn-start');
      timerInterval = setInterval(updateTimer, 1000);
      updateTimer();
      if (tasksBtn) tasksBtn.disabled = false;
    } else {

      isExperimentRunning = false;
      experimentData.endTime = Date.now();
      experimentData.duration = experimentData.endTime - experimentData.startTime;
      experimentBtn.textContent = 'Начать';
      experimentBtn.classList.add('btn-start');
      experimentBtn.classList.remove('btn-stop');
      clearInterval(timerInterval);
      saveExperimentData();
      if (tasksBtn) tasksBtn.disabled = true;
    }
  });


  function formatTime(ms) {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }


  function updateTimer() {
    const currentTime = Date.now()
    const elapsedTime = currentTime - experimentData.startTime
    timerDisplay.textContent = `Время: ${formatTime(elapsedTime)}`
  }


  async function saveExperimentData() {
    if (experimentData.currentTaskId) {
      completeTask(experimentData.currentTaskId)
    }


    if (typeof window !== 'undefined' && typeof window.calibrationAccuracy !== 'undefined') {
      experimentData.calibrationAccuracy = window.calibrationAccuracy;
    } else {
      experimentData.calibrationAccuracy = null;
    }


    if (window._gazeTarget && window._gazeTarget.length > experimentData.gazeData.length) {
      experimentData.gazeData = window._gazeTarget;
    }
    experimentData.statistics = {
      totalTasks: experimentData.tasks.length,
      completedTasks: experimentData.tasks.filter(t => t.completed).length,
      totalGazePoints: experimentData.gazeData.length,
      totalEmotionSamples: experimentData.emotionData.length,
      totalInteractions: experimentData.interactionEvents.length
    }
    
    
    try {
      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ experimentData })
      })
      const result = await response.json()
      if (result.status === 'success') {
        console.log('Данные отправлены на сервер:', result)
        

        alert('Данные эксперимента сохранены! .');
      } else {
        console.error('Ошибка отправки:', result.error)
      }
    } catch (error) {
      console.error('Ошибка соединения с сервером:', error)
    }
  }


  function showLoaderModal(message = 'Выполняется анализ, пожалуйста, подождите...') {
    let loaderModal = document.getElementById('loaderModal');
    if (!loaderModal) {
      loaderModal = document.createElement('div');
      loaderModal.id = 'loaderModal';
      loaderModal.style.position = 'fixed';
      loaderModal.style.top = 0;
      loaderModal.style.left = 0;
      loaderModal.style.width = '100vw';
      loaderModal.style.height = '100vh';
      loaderModal.style.background = 'rgba(0,0,0,0.4)';
      loaderModal.style.display = 'flex';
      loaderModal.style.alignItems = 'center';
      loaderModal.style.justifyContent = 'center';
      loaderModal.style.zIndex = 9999;
      loaderModal.innerHTML = `
        <div style="background:#fff;padding:32px 48px;border-radius:12px;box-shadow:0 2px 16px #0002;text-align:center;min-width:320px;">
          <div class="loader" style="margin-bottom:16px;width:48px;height:48px;border:6px solid #eee;border-top:6px solid #2196f3;border-radius:50%;animation:spin 1s linear infinite;"></div>
          <div style="font-size:18px;">${message}</div>
        </div>
        <style>@keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}</style>
      `;
      document.body.appendChild(loaderModal);
    } else {
      loaderModal.style.display = 'flex';
    }
  }
  function hideLoaderModal() {
    const loaderModal = document.getElementById('loaderModal');
    if (loaderModal) loaderModal.style.display = 'none';
  }



  function addInteractionEvent(type, data = {}) {
    if (!isExperimentRunning) return
    
    experimentData.interactionEvents.push({
      timestamp: Date.now(),
      type: type,
      taskId: experimentData.currentTaskId,
      data: data
    })
  }


  function startTask(taskId, taskDescription) {
    const task = {
      id: taskId,
      description: taskDescription,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      completed: false
    }
    
    experimentData.tasks.push(task)
    experimentData.currentTaskId = taskId
    
    
    addInteractionEvent('task_start', { taskId, description: taskDescription })
  }


  function completeTask(taskId) {
    const task = experimentData.tasks.find(t => t.id === taskId)
    if (task) {
      task.endTime = Date.now()
      task.duration = task.endTime - task.startTime
      task.completed = true
    }
    
    
    addInteractionEvent('task_complete', { taskId })
    
    experimentData.currentTaskId = null
  }


  function recordGazeData(data) {
    if (!isExperimentRunning) return;
    const gazeRecord = {
        timestamp: Date.now(),
        taskId: experimentData.currentTaskId || 'reading',
        x: Math.round(data.x),
        y: Math.round(data.y),
        relativeTime: Date.now() - (experimentData.startTime || Date.now())
    };
    experimentData.gazeData.push(gazeRecord);
    if (window._gazeTarget && window._gazeTarget !== experimentData.gazeData) {
        window._gazeTarget.push(gazeRecord);
    }
  }


  function recordEmotionData(expressions) {
    if (!isExperimentRunning) return;
    experimentData.emotionData.push({
        timestamp: Date.now(),
        taskId: experimentData.currentTaskId,
        pageUrl: currentTaskPageUrl,
        expressions: expressions,
        relativeTime: Date.now() - experimentData.startTime,
        dominantEmotion: getDominantEmotion(expressions)
    });
  }

  function getDominantEmotion(expressions) {
    return Object.entries(expressions).reduce((a, b) => a[1] > b[1] ? a : b)[0]
  }


  function recordError(error, context = {}) {
    experimentData.errors.push({
      timestamp: Date.now(),
      taskId: experimentData.currentTaskId,
      message: error.message,
      stack: error.stack,
      context: context
    })
  }


  tasksBtn.addEventListener('click', () => {
    modal.style.display = 'block'
  })

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none'
  })

  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none'
    }
  })

  const video = document.getElementById('video')
  const video2 = document.createElement('video')
  video2.id = 'video2'
  document.querySelector('#container2').appendChild(video2)


  video.width = 480
  video.height = 360
  video2.width = 480
  video2.height = 360


  const setWebGazerSizes = () => {
    if (!isExperimentRunning) {
    const webgazerContainer = document.getElementById('webgazerVideoContainer')
    const webgazerVideo = document.getElementById('webgazerVideoFeed')
    const webgazerOverlay = document.getElementById('webgazerFaceOverlay')
    const webgazerFeedbackBox = document.getElementById('webgazerFaceFeedbackBox')

    if (webgazerContainer) {
      webgazerContainer.style.width = '480px'
      webgazerContainer.style.height = '360px'
    }
    if (webgazerVideo) {
      webgazerVideo.style.width = '480px'
      webgazerVideo.style.height = '360px'
    }
    if (webgazerOverlay) {
      webgazerOverlay.style.width = '480px'
      webgazerOverlay.style.height = '360px'
    }
    if (webgazerFeedbackBox) {
      webgazerFeedbackBox.style.top = '54.4px'
      webgazerFeedbackBox.style.left = '107.7px'
      webgazerFeedbackBox.style.width = '211.2px'
      webgazerFeedbackBox.style.height = '211.2px'
    }
  }
  }


  document.addEventListener('DOMContentLoaded', async () => {
    try {

    await webgazer.setRegression('ridge')
      .setGazeListener((data, timestamp) => {
        if (data == null) {
          console.log('No gaze data');
          return;
        }
        
        const gazeValues = document.getElementById('gazeValues');
        if (gazeValues) {
          gazeValues.textContent = `X: ${Math.round(data.x)}, Y: ${Math.round(data.y)}`;
        }
        
        if (isExperimentRunning) {
          recordGazeData(data);
        }
      })
        .saveDataAcrossSessions(false)
      .begin();


      webgazer.showVideoPreview(true)
        .showPredictionPoints(true)
        .applyKalmanFilter(false);

      console.log('Webgazer initialized successfully');
      

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        faceapi.nets.faceExpressionNet.loadFromUri('/models')
      ]);
      
      console.log('Face API models loaded successfully');
      startVideo();
      
    } catch (error) {
      console.error('Error during initialization:', error);
      alert('Произошла ошибка при инициализации камеры. Пожалуйста, убедитесь, что у браузера есть доступ к камере.');
    }
    
    const moveWebGazerContainer = () => {
      const webgazerContainer = document.getElementById('webgazerVideoContainer');
      console.log('test');
      if (webgazerContainer) {
        document.querySelector('#container2').appendChild(webgazerContainer)
        setWebGazerSizes()
        
        const loader = document.getElementById('webgazerLoading');
        if (loader) loader.style.display = 'none';
      } else {
        setTimeout(moveWebGazerContainer, 100)
      }
    }

    
    moveWebGazerContainer()

    
    setInterval(setWebGazerSizes, 1000)

    
    function waitForGazeDotAndMotion() {
      let lastPos = null;
      let moved = false;
      let transformLogged = false;
      const loader = document.getElementById('webgazerLoading');
      const check = () => {
        const dot = document.getElementById('webgazerGazeDot');
        if (dot) {
          
          if (!transformLogged && dot.style.transform && dot.style.transform.includes('translate3d')) {
            console.log('webgazerGazeDot получил transform:', dot.style.transform);
            const webgazerVideoContainer = document.getElementById('webgazerVideoContainer');
            if (webgazerVideoContainer) {
              webgazerVideoContainer.style.setProperty('display', 'block', 'important');
            }
            transformLogged = true;
          }
          const pos = { left: dot.style.left, top: dot.style.top };
          if (lastPos && (pos.left !== lastPos.left || pos.top !== lastPos.top)) {
            moved = true;
          }
          lastPos = pos;
          if (moved) {
            if (loader) loader.style.display = 'none';
            return;
          }
        }
        setTimeout(check, 200);
      };
      check();
    }
    waitForGazeDotAndMotion();
  });

  async function checkCameraAccess() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Camera access error:', error);
      return false;
    }
  }

  function startVideo() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      checkCameraAccess().then(hasAccess => {
        if (!hasAccess) {
          alert('Нет доступа к камере. Пожалуйста, разрешите доступ к камере в настройках браузера.');
          return;
        }
        
      navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 } })
        .then(stream => {
          video.srcObject = stream;
          video2.srcObject = stream;
          
          video.style.transform = 'none';
          
          const webgazerVideo = document.getElementById('webgazerVideoFeed');
          if (webgazerVideo) {
            webgazerVideo.style.transform = 'scaleX(-1)';
          }
            
            console.log('камена успешно включена');
        })
        .catch(err => {
          console.error('Ошибка доступа к камере:', err);
            alert('Произошла ошибка при получении доступа к камере: ' + err.message);
          });
        });
    } else {
      alert('Ваш браузер не поддерживает getUserMedia');
    }
  }

  video.addEventListener('play', () => {
    const canvas = faceapi.createCanvasFromMedia(video)
    canvas.width = 480
    canvas.height = 360
    document.querySelector('#container1').appendChild(canvas)
    const displaySize = { width: 480, height: 360 }
    faceapi.matchDimensions(canvas, displaySize)
    setInterval(async () => {
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions()
      const resizedDetections = faceapi.resizeResults(detections, displaySize)
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
      if (!isExperimentRunning) {
      faceapi.draw.drawDetections(canvas, resizedDetections)
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
      faceapi.draw.drawFaceExpressions(canvas, resizedDetections)
      }
      
      if (detections.length > 0) {
        const expressions = detections[0].expressions
        const maxExpression = Object.entries(expressions).reduce((a, b) => a[1] > b[1] ? a : b)
        const faceValues = document.getElementById('faceValues')
        if (!experimentData.currentTaskId) {
        faceValues.textContent = `${maxExpression[0]}: ${(maxExpression[1] * 100).toFixed(1)}%`
        }

        
        if (isExperimentRunning) {
          recordEmotionData(expressions)
        }
      }
    }, 150)
  })




  document.getElementById('startCalibrationBtn').onclick = () => {
    const experimentBtn = document.getElementById('experimentBtn');
    if (experimentBtn) {
        experimentBtn.disabled = false;
        experimentBtn.title = '';
    }
    document.querySelector('.controls').style.display = 'none';
    document.querySelector('.content-offset').style.display = 'none';
    

    const canvas = document.getElementById('plotting_canvas');
    canvas.style.display = 'block';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = '1001';
    

    PopUpInstruction();
  };


  let selectedJsonFiles = [];



  function drawGazePoint(x, y) {
    const canvas = document.getElementById('plotting_canvas');
    const ctx = canvas.getContext('2d');
    

    if (!x || !y || isNaN(x) || isNaN(y)) {
      console.log('Invalid coordinates:', x, y);
      return;
    }
    
    console.log('Drawing point at:', x, y); // отладочная информация
    

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    

    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0, 0, 255, 0.7)';
    ctx.fill();
    

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
  }


  window.addEventListener('resize', () => {
    if (document.getElementById('plotting_canvas').style.display === 'block') {
      showCalibrationUI();
    }
  });


  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      generateSessionId,
      formatTime,
      clearCalibration,
      calPointClick,
      recordGazeData,
      recordEmotionData,
      startTask,
      completeTask,
      calculatePrecisionPercentages,
      experimentData
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('participantModal');
    const form = document.getElementById('participantForm');
    if (modal && form) {
      document.body.style.overflow = 'hidden';
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        const participantNumber = document.getElementById('participantNumber').value.trim();
        const glasses = document.getElementById('glassesCheck').checked;
        const consentData = document.getElementById('consentDataCheck').checked;
        const consentExperiment = document.getElementById('consentExperimentCheck').checked;
        if (!participantNumber || !consentData || !consentExperiment) {
          alert('Пожалуйста, заполните все обязательные поля и дайте согласия.');
          return;
        }

        experimentData.participantNumber = participantNumber;
        experimentData.glasses = glasses;
        experimentData.consentData = consentData;
        experimentData.consentExperiment = consentExperiment;

        window.participantInfo = { participantNumber, glasses, consentData, consentExperiment };

        modal.style.display = 'none';
        document.body.style.overflow = '';
      });
    }
  });


  if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const info = localStorage.getItem('participantInfo');
      if (!info) {
        window.location.href = 'participant.html';
        return;
      }
      try {
        const parsed = JSON.parse(info);
        experimentData.participantNumber = parsed.participantNumber;
        experimentData.glasses = parsed.glasses;
        experimentData.consentData = parsed.consentData;
        experimentData.consentExperiment = parsed.consentExperiment;
      } catch (e) {
        window.location.href = 'participant.html';
      }
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  });



  document.addEventListener('DOMContentLoaded', () => {

    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
        analyzeBtn.style.display = 'none';
    }

    if (!document.getElementById('individualAnalyzeBtn')) {
        const individualBtn = document.createElement('button');
        individualBtn.id = 'individualAnalyzeBtn';
        individualBtn.textContent = 'Индивидуальный анализ';
        individualBtn.className = 'btn btn-info';
        individualBtn.style.margin = '10px 0 0 10px';
        individualBtn.style.display = 'none';
        individualBtn.onclick = () => {
            const sessionIds = prompt('Введите ID двух сессий через запятую (например: session_123, session_456):');
            if (sessionIds) {
                const ids = sessionIds.split(',').map(id => id.trim());
                if (ids.length === 2) {
                    analyzeSessions(ids);
                } else {
                    alert('Пожалуйста, введите ровно два ID сессий через запятую');
                }
            }
        };

        if (analyzeBtn && analyzeBtn.parentNode) {
            analyzeBtn.parentNode.insertBefore(individualBtn, analyzeBtn.nextSibling);
        } else {
            const controls = document.querySelector('.controls');
            if (controls) controls.appendChild(individualBtn);
            else document.body.appendChild(individualBtn);
        }
    }
  });

document.addEventListener('DOMContentLoaded', () => {
    const taskButtons = document.querySelectorAll('.task-start-btn');
    taskButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const taskId = this.dataset.task;
            if (completedTaskIds.has(taskId)) return;
            
            const filename = this.dataset.file;
            loadTaskPage(filename, taskId, this);
        });
    });

    window.addEventListener('message', (event) => {
        if (event.data.type === 'page_changed') {
            currentTaskPageUrl = event.data.url;
            console.log('Переход на страницу:', currentTaskPageUrl);
        }
    });
});


function hideExperimentUI() {
    const controls = document.querySelector('.controls');
    if (controls) controls.style.display = 'none';
}

function showExperimentUI() {
    const controls = document.querySelector('.controls');
    if (controls) controls.style.display = '';
}
window.loadTaskPage = function(filename, taskId, btn) {
    startTask(taskId, filename);
    currentTaskPageUrl = filename;
    modal.style.display = 'none';

    var controls = document.querySelector('.controls');
    var videoContainer = document.querySelector('.video-container');
    var contentOffset = document.querySelector('.content-offset');
    if (controls) controls.style.display = 'none';
    if (videoContainer) videoContainer.style.display = 'none';
    if (contentOffset) contentOffset.style.display = 'none';

    var doneBtn = document.createElement('button');
    doneBtn.id = 'completeTaskBtn';
    doneBtn.textContent = 'Завершить чтение';
    doneBtn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:2147483647;padding:12px 22px;background:#4CAF50;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;font-weight:bold;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
    document.body.appendChild(doneBtn);

    var taskFrame = document.createElement('iframe');
    taskFrame.id = 'taskFrame';
    taskFrame.src = filename;
    taskFrame.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;border:none;background:white;';
    document.body.appendChild(taskFrame);

    doneBtn.onclick = function() {
        completedTaskIds.add(taskId);
        completeTask(taskId);
        btn.classList.add('completed');
        btn.textContent = 'Завершено';
        btn.disabled = true;
        taskFrame.remove();
        doneBtn.remove();
        if (controls) controls.style.display = '';
        if (videoContainer) videoContainer.style.display = '';
        if (contentOffset) contentOffset.style.display = '';
    };
};


}