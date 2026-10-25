// Estimators compared by the evaluator, in report order.

import { CONSTANT_VELOCITY } from './constant-velocity'
import type { EstimatorEntry } from './estimator'
import { IMU_INTEGRATION } from './imu-integration'

export const ESTIMATORS: readonly EstimatorEntry[] = [CONSTANT_VELOCITY, IMU_INTEGRATION]
