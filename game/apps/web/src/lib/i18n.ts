export type Language = "en" | "zh";

export const planetLabels: Record<Language, Record<string, string>> = {
  en: {
    sun: "sun",
    mercury: "mercury",
    venus: "venus",
    earth: "earth",
    mars: "mars",
    jupiter: "jupiter",
    saturn: "saturn",
    uranus: "uranus",
    neptune: "neptune",
  },
  zh: {
    sun: "太阳",
    mercury: "水星",
    venus: "金星",
    earth: "地球",
    mars: "火星",
    jupiter: "木星",
    saturn: "土星",
    uranus: "天王星",
    neptune: "海王星",
  },
};

export const messages = {
  en: {
    languageZh: "中文",
    languageEn: "EN",
    deckEyebrow: "Interplanetary Mission Deck",
    appTitle: "Solar System Trajectory Simulator",
    appLede:
      "Configure a heliocentric departure state on the left, then inspect the propagated trajectory in the live flight view.",
    routeNavigation: "Page Navigation",
    simulatorNavLabel: "Simulator",
    recoveryNavLabel: "SpaceX Recovery",
    spacexRecoveryTitle: "SpaceX Recovery",
    spacexRecoverySubtitle: "A guided 3D explainer for stage separation, boostback, and offshore drone-ship landing.",
    recoveryPageBody: "Use the synchronized scene and playback controls to inspect liftoff, separation, return, and offshore touchdown.",
    recoveryPhaseLabel: "Active Phase",
    recoveryPlaybackLabel: "Playback Controls",
    recoveryTimelineLabel: "Timeline",
    recoverySceneLabel: "Recovery Scene",
    recoverySceneBody: "Track liftoff, stage separation, boostback, and drone-ship landing in the synchronized 3D theatre.",
    recoverySceneFallbackTitle: "This environment cannot display the 3D view.",
    recoverySceneFallbackBody: "The current phase and offshore drone-ship recovery story stay visible even when WebGL is unavailable.",
    missionControlPanel: "Mission Control Panel",
    missionStatus: "Mission Status",
    primaryFlightView: "Primary Flight View",
    languageToggle: "Language Toggle",
    threeCanvas: "Three.js Flight Canvas",
    referenceFrame: "Reference Frame",
    currentEpoch: "Current Epoch",
    ephemerisSource: "Ephemeris Source",
    propagation: "Propagation",
    standby: "Standby",
    running: "Running",
    runningPropagation: "Running propagation...",
    ephemerisRequestFailed: "Ephemeris request failed",
    propagationRequestFailed: "Propagation request failed",
    tourPlanningRequestFailed: "Tour planning request failed",
    telemetrySnapshot: "Telemetry Snapshot",
    readyTitle: "Ready for first propagation",
    readyBody:
      "Launch a trajectory to populate closest approach, warning flags, and flight time telemetry in this console.",
    missionSummary: "Mission Summary",
    candidatePlans: "Gravity-Assist Candidates",
    candidatePlansBody: "Compare ranked assist sequences and switch the active trajectory.",
    scoreLabel: "Score",
    sequenceLabel: "Sequence",
    deltaVLabel: "Delta-v",
    flybyCountLabel: "Flybys",
    flybyEventsLabel: "Flyby Events",
    visitEventsLabel: "Visit Events",
    maneuverEventsLabel: "Maneuver Events",
    selectedCandidateLabel: "Active Plan",
    closestApproach: "Closest Approach",
    target: "Target",
    distance: "Distance",
    flightTime: "Flight Time",
    dayUnit: "days",
    ephemeris: "Ephemeris",
    noWarnings: "No warnings",
    propellantUsed: "Propellant Used",
    finalMass: "Final Mass",
    maneuverCount: "Maneuver Count",
    missionSegments: "Mission Segments",
    turnAngle: "Turn Angle",
    periapsisAltitude: "Periapsis Altitude",
    inboundVInfinity: "Inbound v-infinity",
    outboundVInfinity: "Outbound v-infinity",
    maneuversLabel: "Maneuvers",
    primaryView: "Primary View",
    theatreTitle: "3D Flight Theatre",
    theatreCopy:
      "The main canvas stays dedicated to the solar system view so trajectory playback remains the center of the experience.",
    visualStandby: "Visual standby",
    paintTrajectory: "Run a mission to paint the trajectory",
    standbyBody:
      "The scene will render the probe path, major bodies, and timeline playback once propagation completes.",
    trajectoryScene: "Trajectory Scene",
    fixedBirdsEye: "Fixed bird's-eye Three.js view",
    probePerspective: "Probe Perspective",
    trajectoryOverview: "Trajectory Overview",
    visualFocus: "Visual Focus",
    currentEpochPending: "Current Epoch: pending",
    targetLabel: "Target",
    bodyPrefix: "Body",
    visibleBodies: "Visible Bodies",
    speedTelemetry: "Speed Telemetry",
    currentSpeed: "Current Speed",
    currentSpeedComponent: "Current Velocity Component",
    speedDelta: "Sample Delta",
    speedModeMagnitude: "|v|",
    speedModeVx: "vx",
    speedModeVy: "vy",
    speedModeVz: "vz",
    activeManeuver: "Active Maneuver",
    upcomingManeuver: "Upcoming Maneuver",
    currentPhase: "Current Phase",
    nextEvent: "Next Event",
    missionObjective: "Objective",
    phaseTimeline: "Mission Phase Timeline",
    noUpcomingEvent: "No upcoming event",
    burnDuration: "Burn Duration",
    burnDirection: "Burn Direction",
    remainingMass: "Remaining Mass",
    start: "Start",
    pause: "Pause",
    reset: "Reset",
    playbackStep: "Playback Step",
    zoomLevel: "Zoom Level",
    currentSample: "Current Sample",
    samples: "Samples",
    warnings: "Warnings",
    renderer: "Renderer",
    threeJs: "Three.js",
    fallback: "Fallback",
    missionInput: "Mission Input",
    missionSetup: "Mission Setup",
    visitPlanets: "Visit Planets",
    visitPlanetsHint: "Visit order is optimized automatically.",
    returnToEarth: "Return to Earth",
    propulsionSettings: "Propulsion Settings",
    enableFiniteThrust: "Enable Finite-Thrust Corrections",
    initialMass: "Initial Mass (kg)",
    propellantMass: "Propellant Mass (kg)",
    maxThrust: "Max Thrust (N)",
    ispSeconds: "Specific Impulse (s)",
    navigationDispersionSettings: "Navigation Dispersion",
    enableNavigationDispersion: "Enable Navigation Dispersion",
    fixedRandomSeed: "Fixed Random Seed",
    positionSigmaKm: "Position Sigma (km)",
    velocitySigmaKmPerS: "Velocity Sigma (km/s)",
    maxTcmCount: "Max TCM Count",
    predictedMissThresholdKm: "Predicted Miss Threshold (km)",
    positionDeviationThresholdKm: "Position Deviation Threshold (km)",
    velocityDeviationThresholdKmPerS: "Velocity Deviation Threshold (km/s)",
    checkpointStepSeconds: "Checkpoint Step (s)",
    maxCorrectionDeltaV: "Max Correction Delta-v (km/s)",
    navigationSummary: "Navigation",
    cumulativeCorrectionDeltaV: "Cumulative Correction Delta-v",
    maxPredictedMiss: "Max Predicted Miss",
    maxPositionDeviation: "Max Position Deviation",
    maxVelocityDeviation: "Max Velocity Deviation",
    finalPredictedMiss: "Final Predicted Miss",
    navigationMode: "Navigation Mode",
    navigationNominal: "Nominal",
    navigationDispersed: "Dispersed",
    correctionStatus: "Correction Status",
    withinThresholds: "Within thresholds",
    visitOrderLabel: "Visit Order",
    fullSequenceLabel: "Full Sequence",
    visitCountLabel: "Visits",
    departureBody: "Departure Body",
    launchPlanningMode: "Launch Planning",
    recommendedWindowMode: "Recommended Window",
    windowSelectMode: "Pick Within Window",
    manualLaunchMode: "Manual Date",
    earliestLaunchEpoch: "Earliest Launch Epoch",
    selectedLaunchEpoch: "Selected Launch Date",
    recommendedLaunchWindow: "Recommended Launch Window",
    recommendedLaunchDate: "Best Launch Date",
    launchWindowCandidates: "Candidate Launches",
    launchWindowRequestFailed: "Launch-window request failed",
    trajectoryMode: "Trajectory Mode",
    launchEpoch: "Launch Epoch",
    missionDuration: "Mission Duration (s)",
    outputStep: "Output Step (s)",
    autoTransfer: "Auto Transfer",
    autoTransferBody:
      "The backend will compute a target-driven transfer duration, departure burn, and output cadence.",
    initialStateVector: "Initial State Vector",
    initialStateBody: "All values are expressed in kilometers and kilometers per second.",
    positionX: "Position X (km)",
    positionY: "Position Y (km)",
    positionZ: "Position Z (km)",
    velocityX: "Velocity X (km/s)",
    velocityY: "Velocity Y (km/s)",
    velocityZ: "Velocity Z (km/s)",
    propagateTrajectory: "Propagate Trajectory",
    propagateTrajectoryLoading: "Running propagation...",
    earthLaunch: "Earth Launch",
    launch: "Launch",
    arrivalSuffix: "Arrival",
    assistSuffix: "Assist",
    visitSuffix: "Visit",
    awaitingPropagation: "Awaiting propagation",
    stateVector: "State Vector",
    parkingOrbit: "Parking Orbit",
    earthEscape: "Earth Escape",
    heliocentricCruise: "Heliocentric Cruise",
    gravityAssistFlyby: "Gravity-Assist Flyby",
    flybyEncounter: "Gravity-Assist Flyby",
    arrivalHyperbolicApproach: "Arrival Hyperbolic Approach",
    orbitInsertionBurn: "Orbit Insertion Burn",
    targetApproach: "Target Approach",
    arrivalPass: "Arrival Encounter",
    scienceOperations: "Science Operations",
    downlink: "Downlink",
    maneuverExecution: "Maneuver",
  },
  zh: {
    languageZh: "中文",
    languageEn: "EN",
    deckEyebrow: "星际任务控制台",
    appTitle: "太阳系轨迹模拟器",
    appLede: "左侧配置任务参数，右侧查看真实时间推进的飞行轨迹与太阳系场景。",
    routeNavigation: "页面导航",
    simulatorNavLabel: "模拟器",
    recoveryNavLabel: "回收任务",
    spacexRecoveryTitle: "SpaceX 回收任务",
    spacexRecoverySubtitle: "通过 3D 回收演示理解分离、返向点火和海上无人船着陆。",
    recoveryPageBody: "用同步场景和回放控件查看起飞、分离、折返与海上回收着陆的完整过程。",
    recoveryPhaseLabel: "当前阶段",
    recoveryPlaybackLabel: "回放控制",
    recoveryTimelineLabel: "时间线",
    recoverySceneLabel: "回收场景",
    recoverySceneBody: "在同步的 3D 剧场里查看起飞、分离、返向点火和海上无人船回收。",
    recoverySceneFallbackTitle: "当前环境无法显示 3D 画面。",
    recoverySceneFallbackBody: "即使 WebGL 不可用，当前阶段和海上无人船回收叙事也会继续显示。",
    missionControlPanel: "任务控制面板",
    missionStatus: "任务状态",
    primaryFlightView: "主飞行视图",
    languageToggle: "语言切换",
    threeCanvas: "Three.js 飞行画布",
    referenceFrame: "参考系",
    currentEpoch: "当前时刻",
    ephemerisSource: "星历来源",
    propagation: "传播状态",
    standby: "待命",
    running: "计算中",
    runningPropagation: "正在计算轨迹...",
    ephemerisRequestFailed: "星历请求失败",
    propagationRequestFailed: "轨迹计算失败",
    tourPlanningRequestFailed: "巡游任务计算失败",
    telemetrySnapshot: "遥测概览",
    readyTitle: "等待首次传播",
    readyBody: "发起一次任务后，这里会显示最近接近距离、告警信息和飞行时间。",
    missionSummary: "任务摘要",
    candidatePlans: "引力辅助候选方案",
    candidatePlansBody: "比较排序后的弹弓序列，并切换当前显示的轨迹。",
    scoreLabel: "评分",
    sequenceLabel: "序列",
    deltaVLabel: "Delta-v",
    flybyCountLabel: "飞越次数",
    flybyEventsLabel: "飞越事件",
    visitEventsLabel: "拜访事件",
    maneuverEventsLabel: "机动事件",
    selectedCandidateLabel: "当前方案",
    closestApproach: "最近接近",
    target: "目标",
    distance: "距离",
    flightTime: "飞行时间",
    dayUnit: "天",
    ephemeris: "星历",
    noWarnings: "无告警",
    propellantUsed: "推进剂消耗",
    finalMass: "最终质量",
    maneuverCount: "机动次数",
    missionSegments: "任务分段",
    turnAngle: "转向角",
    periapsisAltitude: "近拱点高度",
    inboundVInfinity: "入轨 v∞",
    outboundVInfinity: "出轨 v∞",
    maneuversLabel: "机动次数",
    primaryView: "主视图",
    theatreTitle: "3D 飞行场景",
    theatreCopy: "主画布专注展示太阳系与探测器飞行过程，让轨迹回放始终是画面中心。",
    visualStandby: "视觉待命",
    paintTrajectory: "运行任务后显示轨迹",
    standbyBody: "传播完成后，这里会显示探测器轨迹、主要天体与时间回放。",
    trajectoryScene: "轨迹场景",
    fixedBirdsEye: "固定鸟瞰 Three.js 视图",
    probePerspective: "探测器视角",
    trajectoryOverview: "轨迹概览",
    visualFocus: "视觉焦点",
    currentEpochPending: "当前时刻：等待中",
    targetLabel: "目标",
    bodyPrefix: "天体",
    visibleBodies: "可见天体",
    speedTelemetry: "速度遥测",
    currentSpeed: "当前速度",
    currentSpeedComponent: "当前速度分量",
    speedDelta: "样本变化",
    speedModeMagnitude: "|v|",
    speedModeVx: "vx",
    speedModeVy: "vy",
    speedModeVz: "vz",
    activeManeuver: "当前机动",
    upcomingManeuver: "下一次机动",
    currentPhase: "当前阶段",
    nextEvent: "下一事件",
    missionObjective: "当前目标",
    phaseTimeline: "任务阶段时间线",
    noUpcomingEvent: "暂无下一事件",
    burnDuration: "点火时长",
    burnDirection: "推力方向",
    remainingMass: "剩余质量",
    start: "开始",
    pause: "暂停",
    reset: "重置",
    playbackStep: "回放步进",
    zoomLevel: "缩放",
    currentSample: "当前样本",
    samples: "样本数",
    warnings: "告警",
    renderer: "渲染器",
    threeJs: "Three.js",
    fallback: "降级模式",
    missionInput: "任务输入",
    missionSetup: "任务设置",
    visitPlanets: "拜访星球",
    visitPlanetsHint: "系统将自动优化访问顺序",
    returnToEarth: "返回地球",
    propulsionSettings: "推进设置",
    enableFiniteThrust: "启用有限推力修正",
    initialMass: "初始质量（kg）",
    propellantMass: "推进剂质量（kg）",
    maxThrust: "最大推力（N）",
    ispSeconds: "比冲（s）",
    navigationDispersionSettings: "导航离散",
    enableNavigationDispersion: "启用导航离散",
    fixedRandomSeed: "固定随机种子",
    positionSigmaKm: "位置离散标准差（km）",
    velocitySigmaKmPerS: "速度离散标准差（km/s）",
    maxTcmCount: "最大 TCM 次数",
    predictedMissThresholdKm: "预测偏差阈值（km）",
    positionDeviationThresholdKm: "位置偏差阈值（km）",
    velocityDeviationThresholdKmPerS: "速度偏差阈值（km/s）",
    checkpointStepSeconds: "检查点步长（s）",
    maxCorrectionDeltaV: "最大修正 Delta-v（km/s）",
    navigationSummary: "导航",
    cumulativeCorrectionDeltaV: "累计修正 Delta-v",
    maxPredictedMiss: "最大预测偏差",
    maxPositionDeviation: "最大位置偏差",
    maxVelocityDeviation: "最大速度偏差",
    finalPredictedMiss: "最终预测偏差",
    navigationMode: "导航模式",
    navigationNominal: "名义轨迹",
    navigationDispersed: "离散飞行轨迹",
    correctionStatus: "修正状态",
    withinThresholds: "处于阈值内",
    visitOrderLabel: "拜访顺序",
    fullSequenceLabel: "完整序列",
    visitCountLabel: "拜访数",
    departureBody: "出发天体",
    launchPlanningMode: "发射方案",
    recommendedWindowMode: "推荐窗口",
    windowSelectMode: "窗口内选择",
    manualLaunchMode: "手动日期",
    earliestLaunchEpoch: "最早发射时刻",
    selectedLaunchEpoch: "选定发射时刻",
    recommendedLaunchWindow: "推荐发射窗口",
    recommendedLaunchDate: "最佳发射日期",
    launchWindowCandidates: "候选发射日",
    launchWindowRequestFailed: "发射窗口计算失败",
    trajectoryMode: "轨迹模式",
    launchEpoch: "发射时刻",
    missionDuration: "任务时长（秒）",
    outputStep: "输出步长（秒）",
    autoTransfer: "自动转移",
    autoTransferBody: "后端会自动计算面向目标的飞行时长、出发速度变化和输出采样节奏。",
    initialStateVector: "初始状态向量",
    initialStateBody: "所有数值单位均为千米和千米每秒。",
    positionX: "位置 X（km）",
    positionY: "位置 Y（km）",
    positionZ: "位置 Z（km）",
    velocityX: "速度 X（km/s）",
    velocityY: "速度 Y（km/s）",
    velocityZ: "速度 Z（km/s）",
    propagateTrajectory: "计算轨迹",
    propagateTrajectoryLoading: "正在计算轨迹...",
    earthLaunch: "地球出发",
    launch: "发射",
    arrivalSuffix: "到达",
    assistSuffix: "飞越",
    visitSuffix: "拜访",
    awaitingPropagation: "等待传播",
    stateVector: "状态向量",
    parkingOrbit: "停泊轨道",
    earthEscape: "地球逃逸",
    heliocentricCruise: "日心巡航",
    gravityAssistFlyby: "引力辅助飞越",
    flybyEncounter: "引力辅助飞越",
    arrivalHyperbolicApproach: "到达双曲逼近",
    orbitInsertionBurn: "入轨制动",
    targetApproach: "目标逼近",
    arrivalPass: "到达交会",
    scienceOperations: "科学探测",
    downlink: "数据回传",
    maneuverExecution: "轨道机动",
  },
} as const;

export function t(language: Language) {
  return messages[language];
}

export function planetLabel(language: Language, bodyId: string) {
  return planetLabels[language][bodyId] ?? bodyId;
}

export function localizeWarning(language: Language, warning: string) {
  if (language === "en") {
    return warning;
  }

  const deltaVMatch = warning.match(/^Auto-transfer delta-v estimate: ([\d.]+) km\/s$/);
  if (deltaVMatch) {
    return `自动转移 Δv 估算：${deltaVMatch[1]} km/s`;
  }

  const missDistanceMatch = warning.match(/^Planned arrival miss distance estimate: ([\d.]+) km$/);
  if (missDistanceMatch) {
    return `规划到达偏差估算：${missDistanceMatch[1]} km`;
  }

  if (warning === "Probe distance exceeds the trusted phase-1 operating range") {
    return "探测器距离超出第一阶段可信工作范围";
  }

  if (warning === "No trajectory samples were produced") {
    return "未生成轨迹样本";
  }

  return warning;
}

export function localizeMissionSegment(language: Language, segmentType: string) {
  const copy = t(language);

  if (segmentType === "launch") {
    return copy.launch;
  }

  if (segmentType === "launchParkingOrbit") {
    return copy.parkingOrbit;
  }

  if (segmentType === "earthEscape") {
    return copy.earthEscape;
  }

  if (segmentType === "heliocentricCruise") {
    return copy.heliocentricCruise;
  }

  if (segmentType === "gravityAssistFlyby") {
    return copy.gravityAssistFlyby;
  }

  if (segmentType === "flybyEncounter") {
    return copy.flybyEncounter;
  }

  if (segmentType === "arrivalHyperbolicApproach") {
    return copy.arrivalHyperbolicApproach;
  }

  if (segmentType === "orbitInsertionBurn") {
    return copy.orbitInsertionBurn;
  }

  if (segmentType === "targetApproach") {
    return copy.targetApproach;
  }

  if (segmentType === "arrivalPass") {
    return copy.arrivalPass;
  }

  if (segmentType === "scienceOperations") {
    return copy.scienceOperations;
  }

  if (segmentType === "downlink") {
    return copy.downlink;
  }

  if (segmentType === "maneuverExecution") {
    return copy.maneuverExecution;
  }

  return segmentType;
}
