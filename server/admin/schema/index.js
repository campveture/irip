'use strict';
const AREAS = ['content', 'curriculum', 'teaching', 'learner', 'mentor', 'operations', 'enrollments', 'accounts'];
function initAreaSchemas(db) { for (const area of AREAS) require(`./${area}`)(db); }
module.exports = { initAreaSchemas };
