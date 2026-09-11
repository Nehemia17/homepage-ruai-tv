// ============================================================
// RUAI TV — schedule.js (Dynamic Multi-Program Grid Support)
// Dynamic Weekly Schedule Table Generator with Stacked Cell Support
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  const daysList = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];
  const STORAGE_KEY = 'ruai_tv_programs_data';
  const API_URL = 'api/programs.php';

  let programsData = [];

  // ─── 1. Load Programs Data (MySQL API -> localStorage -> programs.json) ───
  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      const apiData = await res.json();
      if (Array.isArray(apiData) && apiData.length > 0) {
        programsData = apiData;
      }
    }
  } catch (e) {}

  if (!programsData || programsData.length === 0) {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      try {
        programsData = JSON.parse(localData);
      } catch (e) {}
    }
  }

  if (!programsData || programsData.length === 0) {
    try {
      const res = await fetch('assets/data/programs.json');
      if (res.ok) {
        programsData = await res.json();
      }
    } catch (e) {}
  }

  // ─── 2. Base 9 Time Slots Structure ───
  const baseSlots = [
    { group: 'PAGI', timeKey: '07.00', timeLabel: '07.00 WIB', defaultProgs: ['Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', null] },
    { group: 'PAGI', timeKey: '10.00', timeLabel: '10.00 WIB', defaultProgs: ['Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', null] },
    { group: 'SIANG', timeKey: '13.00', timeLabel: '13.00 WIB', defaultProgs: ['Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', null] },
    { group: 'SORE', timeKey: '15.00', timeLabel: '15.00 WIB', defaultProgs: ['Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', null] },
    { group: 'SORE', timeKey: '17.00', timeLabel: '17.00 WIB', defaultProgs: ['Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', null] },
    { group: 'SORE', timeKey: '18.30', timeLabel: '18.30 WIB', defaultProgs: [null, 'Warta Warganet', null, null, 'Warta Warganet', null, null] },
    { group: 'MALAM', timeKey: '19.00', timeLabel: '19.00 WIB', defaultProgs: ['Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', null] },
    { group: 'MALAM', timeKey: '19.30', timeLabel: '19.30 WIB', defaultProgs: [null, 'Gong Ruai', null, null, 'Gong Ruai', null, 'Ruai Sepekan'] },
    { group: 'MALAM', timeKey: '20.05', timeLabel: '20.05 WIB', defaultProgs: ['Rumah Kita', null, null, 'Forum Ruai', null, null, null] }
  ];

  // Helper to parse day string into array of day names
  const parseDays = (daysStr) => {
    if (!daysStr) return [];
    const str = daysStr.toUpperCase().trim();
    if (str.includes('SENIN - SABTU') || str.includes('SENIN – SABTU')) {
      return ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    }
    if (str.includes('SENIN - MINGGU') || str.includes('SENIN – MINGGU') || str.includes('SETIAP HARI')) {
      return ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];
    }
    return daysList.filter(d => str.includes(d));
  };

  // ─── 3. Build Dynamic Grid Matrix with Multi-Program Array ───
  const gridMatrix = baseSlots.map(slot => ({
    group: slot.group,
    timeLabel: slot.timeLabel,
    programs: slot.defaultProgs.map(p => p ? [p] : [])
  }));

  // Populate matrix if active program data exists
  if (Array.isArray(programsData) && programsData.length > 0) {
    programsData.forEach(prog => {
      if (!prog || prog.status !== 'aktif' || !prog.schedule) return;

      const scheduleKeys = ['pagi', 'siang', 'malam'];
      scheduleKeys.forEach(sKey => {
        const slotData = prog.schedule[sKey];
        if (slotData && slotData.active && slotData.time) {
          const daysMatched = parseDays(slotData.days);
          
          // Match against baseSlots by timeKey
          baseSlots.forEach((slot, slotIdx) => {
            if (slotData.time.includes(slot.timeKey)) {
              daysMatched.forEach(dayName => {
                const dayIdx = daysList.indexOf(dayName);
                if (dayIdx !== -1) {
                  const cellArr = gridMatrix[slotIdx].programs[dayIdx];
                  if (!cellArr.includes(prog.title)) {
                    cellArr.push(prog.title);
                  }
                }
              });
            }
          });
        }
      });
    });
  }

  // ─── 4. Render Table DOM ───
  const tbody = document.getElementById('schedule-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  gridMatrix.forEach((slot) => {
    const row = document.createElement('tr');

    // BLOK + TIME column
    const timeCell = document.createElement('td');
    timeCell.className = 'sched-time-cell';
    timeCell.innerHTML = `
      <div class="sched-blok-tag">${slot.group}</div>
      <div class="sched-time-val">${slot.timeLabel}</div>
    `;
    row.appendChild(timeCell);

    // Day columns (SENIN - MINGGU)
    slot.programs.forEach((progArr, i) => {
      const td = document.createElement('td');
      td.className = 'sched-prog-cell';
      if (progArr && progArr.length > 0) {
        progArr.forEach(pTitle => {
          const pill = document.createElement('div');
          pill.className = 'sched-pill';
          pill.textContent = pTitle;
          pill.title = `${daysList[i]}, ${slot.timeLabel} — ${pTitle}`;
          td.appendChild(pill);
        });
      } else {
        const empty = document.createElement('span');
        empty.className = 'sched-empty';
        empty.textContent = '—';
        td.appendChild(empty);
      }
      row.appendChild(td);
    });

    tbody.appendChild(row);
  });

});
