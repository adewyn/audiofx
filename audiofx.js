{\rtf1\ansi\ansicpg1252\cocoartf2821
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 // Core AudioEffectsProcessor class\
class AudioEffectsProcessor \{\
  constructor() \{\
    // Initialize Web Audio API\
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();\
    this.isRecording = false;\
    this.recorder = null;\
    this.audioChunks = [];\
    this.audioBuffer = null;\
    this.source = null;\
    \
    // Effect nodes\
    this.gainNode = this.audioContext.createGain();\
    this.delayNode = this.audioContext.createDelay(5.0); // Max 5 seconds delay\
    this.feedbackNode = this.audioContext.createGain();\
    this.distortionNode = this.audioContext.createWaveShaper();\
    this.filterNode = this.audioContext.createBiquadFilter();\
    this.convolverNode = this.audioContext.createConvolver();\
    this.noiseNode = null;\
    \
    // Default settings\
    this.setupDefaultEffects();\
    \
    // Connect output\
    this.outputNode = this.audioContext.destination;\
  \}\
  \
  setupDefaultEffects() \{\
    // Set default effect parameters\
    this.gainNode.gain.value = 1.0;\
    this.delayNode.delayTime.value = 0.5;\
    this.feedbackNode.gain.value = 0.3;\
    this.filterNode.type = 'lowpass';\
    this.filterNode.frequency.value = 1000;\
    this.filterNode.Q.value = 1;\
    \
    // Setup distortion curve\
    this.makeDistortionCurve(400);\
  \}\
  \
  // Set up audio routing for effects\
  setupAudioRouting() \{\
    // Clear previous connections\
    this.gainNode.disconnect();\
    this.delayNode.disconnect();\
    this.feedbackNode.disconnect();\
    this.distortionNode.disconnect();\
    this.filterNode.disconnect();\
    \
    // Basic audio path: source -> gain -> filter -> distortion -> output\
    if (this.source) \{\
      this.source.connect(this.gainNode);\
    \}\
    \
    this.gainNode.connect(this.filterNode);\
    this.filterNode.connect(this.distortionNode);\
    \
    // Delay path with feedback loop\
    this.distortionNode.connect(this.delayNode);\
    this.delayNode.connect(this.feedbackNode);\
    this.feedbackNode.connect(this.delayNode);\
    \
    // Final output\
    this.distortionNode.connect(this.outputNode);\
    this.delayNode.connect(this.outputNode);\
  \}\
  \
  // Start recording audio from microphone\
  async startRecording() \{\
    if (this.isRecording) return;\
    \
    try \{\
      const stream = await navigator.mediaDevices.getUserMedia(\{ audio: true \});\
      this.isRecording = true;\
      this.audioChunks = [];\
      \
      // Create media recorder\
      this.recorder = new MediaRecorder(stream);\
      \
      this.recorder.ondataavailable = (event) => \{\
        if (event.data.size > 0) \{\
          this.audioChunks.push(event.data);\
        \}\
      \};\
      \
      this.recorder.onstop = () => \{\
        const audioBlob = new Blob(this.audioChunks, \{ type: 'audio/wav' \});\
        this.loadAudioFromBlob(audioBlob);\
      \};\
      \
      this.recorder.start();\
      return true;\
    \} catch (error) \{\
      console.error('Error starting recording:', error);\
      return false;\
    \}\
  \}\
  \
  // Stop recording\
  stopRecording() \{\
    if (!this.isRecording || !this.recorder) return;\
    \
    this.isRecording = false;\
    this.recorder.stop();\
    \
    // Stop all tracks on the stream\
    if (this.recorder.stream) \{\
      this.recorder.stream.getTracks().forEach(track => track.stop());\
    \}\
  \}\
  \
  // Load audio from a File or Blob\
  loadAudioFromBlob(blob) \{\
    const fileReader = new FileReader();\
    \
    fileReader.onload = async (event) => \{\
      try \{\
        // Decode audio data\
        const arrayBuffer = event.target.result;\
        this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);\
        console.log('Audio loaded successfully', this.audioBuffer);\
      \} catch (error) \{\
        console.error('Error decoding audio data:', error);\
      \}\
    \};\
    \
    fileReader.onerror = (error) => \{\
      console.error('Error reading file:', error);\
    \};\
    \
    fileReader.readAsArrayBuffer(blob);\
  \}\
  \
  // Load audio from a URL\
  async loadAudioFromUrl(url) \{\
    try \{\
      const response = await fetch(url);\
      const arrayBuffer = await response.arrayBuffer();\
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);\
      console.log('Audio loaded successfully', this.audioBuffer);\
      return true;\
    \} catch (error) \{\
      console.error('Error loading audio from URL:', error);\
      return false;\
    \}\
  \}\
  \
  // Play the loaded audio with effects\
  playAudio(loop = false) \{\
    if (!this.audioBuffer) \{\
      console.error('No audio loaded');\
      return false;\
    \}\
    \
    // Stop any currently playing audio\
    this.stopAudio();\
    \
    // Resume audio context if it's suspended\
    if (this.audioContext.state === 'suspended') \{\
      this.audioContext.resume();\
    \}\
    \
    // Create a new source\
    this.source = this.audioContext.createBufferSource();\
    this.source.buffer = this.audioBuffer;\
    this.source.loop = loop;\
    \
    // Set up routing\
    this.setupAudioRouting();\
    \
    // Start playback\
    this.source.start();\
    return true;\
  \}\
  \
  // Stop audio playback\
  stopAudio() \{\
    if (this.source) \{\
      try \{\
        this.source.stop();\
      \} catch (e) \{\
        // Source might already be stopped\
      \}\
      this.source = null;\
    \}\
  \}\
  \
  // Generate and connect a noise generator\
  createNoiseGenerator(noiseType = 'white', gain = 0.5) \{\
    // Create buffer for noise\
    const bufferSize = 2 * this.audioContext.sampleRate;\
    const noiseBuffer = this.audioContext.createBuffer(\
      1, \
      bufferSize, \
      this.audioContext.sampleRate\
    );\
    \
    // Fill the buffer with noise\
    const data = noiseBuffer.getChannelData(0);\
    \
    switch (noiseType) \{\
      case 'white':\
        for (let i = 0; i < bufferSize; i++) \{\
          data[i] = Math.random() * 2 - 1;\
        \}\
        break;\
        \
      case 'pink':\
        // Simple approximation of pink noise\
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;\
        for (let i = 0; i < bufferSize; i++) \{\
          const white = Math.random() * 2 - 1;\
          b0 = 0.99886 * b0 + white * 0.0555179;\
          b1 = 0.99332 * b1 + white * 0.0750759;\
          b2 = 0.96900 * b2 + white * 0.1538520;\
          b3 = 0.86650 * b3 + white * 0.3104856;\
          b4 = 0.55000 * b4 + white * 0.5329522;\
          b5 = -0.7616 * b5 - white * 0.0168980;\
          data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;\
          data[i] *= 0.11; // Scale to appropriate level\
          b6 = white * 0.115926;\
        \}\
        break;\
        \
      case 'brown':\
        // Brown noise (integrated white noise)\
        let lastOut = 0.0;\
        for (let i = 0; i < bufferSize; i++) \{\
          const white = Math.random() * 2 - 1;\
          data[i] = (lastOut + (0.02 * white)) / 1.02;\
          lastOut = data[i];\
          data[i] *= 3.5; // Scale to appropriate level\
        \}\
        break;\
    \}\
    \
    // Create noise source\
    if (this.noiseNode) \{\
      this.noiseNode.disconnect();\
    \}\
    \
    this.noiseNode = this.audioContext.createBufferSource();\
    this.noiseNode.buffer = noiseBuffer;\
    this.noiseNode.loop = true;\
    \
    // Create gain for noise\
    this.noiseGain = this.audioContext.createGain();\
    this.noiseGain.gain.value = gain;\
    \
    // Connect\
    this.noiseNode.connect(this.noiseGain);\
    this.noiseGain.connect(this.gainNode);\
    \
    // Start noise\
    this.noiseNode.start();\
    \
    return this.noiseNode;\
  \}\
  \
  // Stop noise generator\
  stopNoiseGenerator() \{\
    if (this.noiseNode) \{\
      this.noiseNode.stop();\
      this.noiseNode = null;\
    \}\
  \}\
  \
  // Create a distortion curve\
  makeDistortionCurve(amount = 50) \{\
    const k = typeof amount === 'number' ? amount : 50;\
    const n_samples = 44100;\
    const curve = new Float32Array(n_samples);\
    const deg = Math.PI / 180;\
    \
    for (let i = 0; i < n_samples; i++) \{\
      const x = (i * 2) / n_samples - 1;\
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));\
    \}\
    \
    this.distortionNode.curve = curve;\
    return curve;\
  \}\
  \
  // Set delay time\
  setDelayTime(time) \{\
    if (time >= 0 && time <= 5) \{\
      this.delayNode.delayTime.value = time;\
    \}\
  \}\
  \
  // Set delay feedback\
  setDelayFeedback(feedback) \{\
    if (feedback >= 0 && feedback < 1) \{\
      this.feedbackNode.gain.value = feedback;\
    \}\
  \}\
  \
  // Set filter frequency\
  setFilterFrequency(frequency) \{\
    if (frequency > 0 && frequency < this.audioContext.sampleRate / 2) \{\
      this.filterNode.frequency.value = frequency;\
    \}\
  \}\
  \
  // Set filter resonance (Q)\
  setFilterResonance(q) \{\
    if (q > 0) \{\
      this.filterNode.Q.value = q;\
    \}\
  \}\
  \
  // Set filter type\
  setFilterType(type) \{\
    const validTypes = ['lowpass', 'highpass', 'bandpass', 'notch', 'allpass'];\
    if (validTypes.includes(type)) \{\
      this.filterNode.type = type;\
    \}\
  \}\
  \
  // Set distortion amount\
  setDistortion(amount) \{\
    this.makeDistortionCurve(amount);\
  \}\
  \
  // Create reverb from impulse response\
  async createReverb(impulseResponseUrl) \{\
    try \{\
      const response = await fetch(impulseResponseUrl);\
      const arrayBuffer = await response.arrayBuffer();\
      this.convolverNode.buffer = await this.audioContext.decodeAudioData(arrayBuffer);\
      \
      // Connect convolver\
      this.distortionNode.disconnect(this.outputNode);\
      this.distortionNode.connect(this.convolverNode);\
      this.convolverNode.connect(this.outputNode);\
      \
      return true;\
    \} catch (error) \{\
      console.error('Error loading impulse response:', error);\
      return false;\
    \}\
  \}\
  \
  // Bypass reverb\
  bypassReverb() \{\
    if (this.convolverNode) \{\
      this.convolverNode.disconnect();\
      this.distortionNode.connect(this.outputNode);\
    \}\
  \}\
  \
  // Create granular synthesis effect\
  createGranularEffect(grainSize = 0.1, density = 0.8) \{\
    if (!this.audioBuffer) return;\
    \
    // Stop current playback\
    this.stopAudio();\
    \
    // Parameters\
    const bufferDuration = this.audioBuffer.duration;\
    const grainDuration = grainSize; // in seconds\
    const grainsPerSecond = density * 10; // adjust density\
    const interval = 1 / grainsPerSecond;\
    \
    // Create gain node for this effect\
    const grainMaster = this.audioContext.createGain();\
    grainMaster.connect(this.gainNode);\
    \
    // Schedule grains\
    const scheduleGrain = () => \{\
      // Create grain source\
      const grainSource = this.audioContext.createBufferSource();\
      grainSource.buffer = this.audioBuffer;\
      \
      // Create envelope for grain\
      const envelope = this.audioContext.createGain();\
      envelope.gain.value = 0;\
      \
      // Random position in buffer\
      const position = Math.random() * (bufferDuration - grainDuration);\
      \
      // Connect\
      grainSource.connect(envelope);\
      envelope.connect(grainMaster);\
      \
      // Envelope shape\
      const now = this.audioContext.currentTime;\
      envelope.gain.setValueAtTime(0, now);\
      envelope.gain.linearRampToValueAtTime(0.5, now + grainDuration * 0.1);\
      envelope.gain.linearRampToValueAtTime(0, now + grainDuration);\
      \
      // Start grain\
      grainSource.start(now, position, grainDuration);\
      grainSource.stop(now + grainDuration);\
      \
      // Schedule next grain\
      this.grainTimeout = setTimeout(scheduleGrain, interval * 1000);\
    \};\
    \
    // Start granular process\
    scheduleGrain();\
    \
    return grainMaster;\
  \}\
  \
  // Stop granular effect\
  stopGranularEffect() \{\
    if (this.grainTimeout) \{\
      clearTimeout(this.grainTimeout);\
      this.grainTimeout = null;\
    \}\
  \}\
  \
  // Clean up resources\
  dispose() \{\
    this.stopAudio();\
    this.stopNoiseGenerator();\
    this.stopGranularEffect();\
    \
    if (this.audioContext) \{\
      this.audioContext.close();\
    \}\
  \}\
\}\
\
// UI Controller for the app\
class AudioEffectsApp \{\
  constructor() \{\
    this.processor = new AudioEffectsProcessor();\
    this.setupEventListeners();\
  \}\
  \
  setupEventListeners() \{\
    // Record button\
    document.getElementById('recordButton').addEventListener('click', () => \{\
      if (!this.processor.isRecording) \{\
        this.processor.startRecording();\
        document.getElementById('recordButton').textContent = 'Stop Recording';\
      \} else \{\
        this.processor.stopRecording();\
        document.getElementById('recordButton').textContent = 'Record';\
      \}\
    \});\
    \
    // Play button\
    document.getElementById('playButton').addEventListener('click', () => \{\
      this.processor.playAudio(document.getElementById('loopCheckbox').checked);\
    \});\
    \
    // Stop button\
    document.getElementById('stopButton').addEventListener('click', () => \{\
      this.processor.stopAudio();\
    \});\
    \
    // Sample selector\
    document.getElementById('sampleSelector').addEventListener('change', (e) => \{\
      const url = e.target.value;\
      if (url) \{\
        this.processor.loadAudioFromUrl(url);\
      \}\
    \});\
    \
    // Delay time slider\
    document.getElementById('delayTime').addEventListener('input', (e) => \{\
      this.processor.setDelayTime(parseFloat(e.target.value));\
      document.getElementById('delayTimeValue').textContent = e.target.value + 's';\
    \});\
    \
    // Delay feedback slider\
    document.getElementById('delayFeedback').addEventListener('input', (e) => \{\
      this.processor.setDelayFeedback(parseFloat(e.target.value));\
      document.getElementById('delayFeedbackValue').textContent = e.target.value;\
    \});\
    \
    // Filter frequency slider\
    document.getElementById('filterFreq').addEventListener('input', (e) => \{\
      this.processor.setFilterFrequency(parseFloat(e.target.value));\
      document.getElementById('filterFreqValue').textContent = e.target.value + 'Hz';\
    \});\
    \
    // Filter resonance slider\
    document.getElementById('filterQ').addEventListener('input', (e) => \{\
      this.processor.setFilterResonance(parseFloat(e.target.value));\
      document.getElementById('filterQValue').textContent = e.target.value;\
    \});\
    \
    // Filter type selector\
    document.getElementById('filterType').addEventListener('change', (e) => \{\
      this.processor.setFilterType(e.target.value);\
    \});\
    \
    // Distortion amount slider\
    document.getElementById('distortion').addEventListener('input', (e) => \{\
      this.processor.setDistortion(parseFloat(e.target.value));\
      document.getElementById('distortionValue').textContent = e.target.value;\
    \});\
    \
    // Noise type selector\
    document.getElementById('noiseType').addEventListener('change', (e) => \{\
      this.updateNoiseGenerator();\
    \});\
    \
    // Noise gain slider\
    document.getElementById('noiseGain').addEventListener('input', (e) => \{\
      this.updateNoiseGenerator();\
      document.getElementById('noiseGainValue').textContent = e.target.value;\
    \});\
    \
    // Noise toggle\
    document.getElementById('noiseToggle').addEventListener('change', (e) => \{\
      if (e.target.checked) \{\
        this.updateNoiseGenerator();\
      \} else \{\
        this.processor.stopNoiseGenerator();\
      \}\
    \});\
    \
    // Granular toggle\
    document.getElementById('granularToggle').addEventListener('change', (e) => \{\
      if (e.target.checked) \{\
        const size = parseFloat(document.getElementById('grainSize').value);\
        const density = parseFloat(document.getElementById('grainDensity').value);\
        this.processor.createGranularEffect(size, density);\
      \} else \{\
        this.processor.stopGranularEffect();\
      \}\
    \});\
    \
    // Grain size slider\
    document.getElementById('grainSize').addEventListener('input', (e) => \{\
      document.getElementById('grainSizeValue').textContent = e.target.value + 's';\
      if (document.getElementById('granularToggle').checked) \{\
        const size = parseFloat(e.target.value);\
        const density = parseFloat(document.getElementById('grainDensity').value);\
        this.processor.stopGranularEffect();\
        this.processor.createGranularEffect(size, density);\
      \}\
    \});\
    \
    // Grain density slider\
    document.getElementById('grainDensity').addEventListener('input', (e) => \{\
      document.getElementById('grainDensityValue').textContent = e.target.value;\
      if (document.getElementById('granularToggle').checked) \{\
        const size = parseFloat(document.getElementById('grainSize').value);\
        const density = parseFloat(e.target.value);\
        this.processor.stopGranularEffect();\
        this.processor.createGranularEffect(size, density);\
      \}\
    \});\
    \
    // File upload\
    document.getElementById('fileUpload').addEventListener('change', (e) => \{\
      const file = e.target.files[0];\
      if (file) \{\
        this.processor.loadAudioFromBlob(file);\
      \}\
    \});\
  \}\
  \
  updateNoiseGenerator() \{\
    if (!document.getElementById('noiseToggle').checked) return;\
    \
    const type = document.getElementById('noiseType').value;\
    const gain = parseFloat(document.getElementById('noiseGain').value);\
    this.processor.stopNoiseGenerator();\
    this.processor.createNoiseGenerator(type, gain);\
  \}\
\}\
\
// Initialize app when the document is ready\
document.addEventListener('DOMContentLoaded', () => \{\
  const app = new AudioEffectsApp();\
\});}