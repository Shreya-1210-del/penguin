// routes/scenario.js — POST /api/scenario/* lifecycle endpoints

const { Router } = require('express');
const {
  getState,
  startBlizzard,
  stopBlizzard,
  startGeneratorFailure,
  repairGenerator,
  resetSimulation,
} = require('../stationState');

const router = Router();

/**
 * POST /api/scenario/blizzard/start (and alias /api/scenario/blizzard)
 * Shifts OU process mean to -55 °C and sets activeScenarios.blizzard = true.
 */
function handleBlizzardStart(req, res, next) {
  try {
    startBlizzard();
    res.json({
      success: true,
      message: 'Blizzard scenario activated',
      state: getState(),
    });
  } catch (err) {
    next(err);
  }
}
router.post('/scenario/blizzard/start', handleBlizzardStart);
router.post('/scenario/blizzard', handleBlizzardStart);

/**
 * POST /api/scenario/blizzard/stop
 * Restores OU process mean to -20 °C and sets activeScenarios.blizzard = false.
 */
router.post('/scenario/blizzard/stop', (req, res, next) => {
  try {
    stopBlizzard();
    res.json({
      success: true,
      message: 'Blizzard scenario stopped',
      state: getState(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/scenario/generator-failure/start (and alias /api/scenario/generator-failure)
 * Activates 1.5× burn rate multiplier and sets activeScenarios.generatorFailure = true.
 */
function handleGenFailureStart(req, res, next) {
  try {
    startGeneratorFailure();
    res.json({
      success: true,
      message: 'Generator failure activated',
      state: getState(),
    });
  } catch (err) {
    next(err);
  }
}
router.post('/scenario/generator-failure/start', handleGenFailureStart);
router.post('/scenario/generator-failure', handleGenFailureStart);

/**
 * POST /api/scenario/generator-failure/stop
 * Clears failure multiplier and sets activeScenarios.generatorFailure = false.
 */
router.post('/scenario/generator-failure/stop', (req, res, next) => {
  try {
    repairGenerator();
    res.json({
      success: true,
      message: 'Generator repaired',
      state: getState(),
    });
  } catch (err) {
    next(err);
  }
});
router.post('/scenario/generator-failure/repair', (req, res, next) => {
  try {
    repairGenerator();
    res.json({
      success: true,
      message: 'Generator repaired',
      state: getState(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/scenario/reset
 * Restores full baseline state.
 */
router.post('/scenario/reset', (req, res, next) => {
  try {
    resetSimulation();
    res.json({
      success: true,
      message: 'Simulation reset',
      state: getState(),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

