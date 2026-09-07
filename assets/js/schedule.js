// ============================================================
// RUAI TV — schedule.js (Pixel-Perfect Figma Revision)
// Handles: Jadwal siaran mingguan — 9 slot waktu 
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  const days = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];

  // Exact 9 time slots matching Figma screenshot
  const timeSlots = [
    {
      group: 'PAGI', time: '07.00 WIB',
      programs: ['Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', null]
    },
    {
      group: 'PAGI', time: '10.00 WIB',
      programs: ['Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', null]
    },
    {
      group: 'SIANG', time: '13.00 WIB',
      programs: ['Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', null]
    },
    {
      group: 'SORE', time: '15.00 WIB',
      programs: ['Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', null]
    },
    {
      group: 'SORE', time: '17.00 WIB',
      programs: ['Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', 'Kilas Ruai', null]
    },
    {
      group: 'SORE', time: '18.30 WIB',
      programs: [null, 'Warta Warganet', null, null, 'Warta Warganet', null, null]
    },
    {
      group: 'MALAM', time: '19.00 WIB',
      programs: ['Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', 'Warta Ruai', null]
    },
    {
      group: 'MALAM', time: '19.30 WIB',
      programs: [null, 'Gong Ruai', null, null, 'Gong Ruai', null, 'Ruai Sepekan']
    },
    {
      group: 'MALAM', time: '20.05 WIB',
      programs: ['Rumah kita', null, null, 'Forum Ruai', null, null, null]
    }
  ];

  const tbody = document.getElementById('schedule-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  timeSlots.forEach((slot) => {
    const row = document.createElement('tr');

    // BLOK + TIME column
    const timeCell = document.createElement('td');
    timeCell.className = 'sched-time-cell';
    timeCell.innerHTML = `
      <div class="sched-blok-tag">${slot.group}</div>
      <div class="sched-time-val">${slot.time}</div>
    `;
    row.appendChild(timeCell);

    // Day columns
    slot.programs.forEach((prog, i) => {
      const td = document.createElement('td');
      td.className = 'sched-prog-cell';
      if (prog) {
        const pill = document.createElement('div');
        pill.className = 'sched-pill';
        pill.textContent = prog;
        pill.title = `${days[i]}, ${slot.time} — ${prog}`;
        td.appendChild(pill);
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

