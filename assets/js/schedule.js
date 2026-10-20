// ============================================================
// RUAI TV — schedule.js
// Tabel Jadwal Siaran Sepekan, dibangun sepenuhnya dari data program
// (dashboard admin). Program berstatus Arsip tidak tampil. Baris jam
// dibentuk dari jam tayang yang ada, jadi tidak ada jadwal bawaan.
// Aturan parsing jam/hari: assets/js/schedule-utils.js
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  const Schedule = window.RuaiSchedule;
  const daysList = Schedule.DAYS;

  let programsData = [];

  // ─── 1. Load Programs Data (Supabase -> programs.json) ───
  if (window.RuaiSupabase && window.RuaiSupabase.getConfig().isConfigured) {
    try {
      const sbData = await window.RuaiSupabase.getPrograms();
      if (Array.isArray(sbData) && sbData.length > 0) {
        programsData = sbData.map(p => ({
          ...p,
          schedule: p.schedule_json || p.schedule
        }));
      }
    } catch (e) {
      console.warn('Supabase fetch failed in schedule.js:', e);
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

  // ─── 2. Kumpulkan jadwal dari program aktif ───
  // rows: Map<menitMulai, { label, cells: Array(7) of [{title, airings}] }>
  const rows = new Map();

  (Array.isArray(programsData) ? programsData : []).forEach(prog => {
    if (!prog || prog.status !== 'aktif') return;
    const airings = Schedule.countWeeklyAirings(prog);

    Schedule.getEntries(prog).forEach(entry => {
      const key = entry.start.minutes;
      if (!rows.has(key)) {
        rows.set(key, {
          group: Schedule.blockOf(key),
          timeLabel: `${entry.start.label} WIB`,
          cells: daysList.map(() => [])
        });
      }
      const row = rows.get(key);
      entry.days.forEach(dayIdx => {
        const cell = row.cells[dayIdx];
        if (!cell.some(item => item.title === prog.title)) {
          cell.push({ title: prog.title, airings });
        }
      });
    });
  });

  // Program yang paling sering tayang tampil lebih dulu dalam satu sel
  const sortedRows = [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => {
      row.cells.forEach(cell => cell.sort((a, b) => b.airings - a.airings || a.title.localeCompare(b.title, 'id')));
      return row;
    });

  // ─── 3. Render Table DOM ───
  const tbody = document.getElementById('schedule-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (sortedRows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = daysList.length + 1;
    td.className = 'sched-empty-state';
    td.textContent = 'Belum ada jadwal tayang yang terdaftar.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  sortedRows.forEach((slot) => {
    const row = document.createElement('tr');

    // BLOK + TIME column
    const timeCell = document.createElement('td');
    timeCell.className = 'sched-time-cell';
    const blok = document.createElement('div');
    blok.className = 'sched-blok-tag';
    blok.textContent = slot.group;
    const time = document.createElement('div');
    time.className = 'sched-time-val';
    time.textContent = slot.timeLabel;
    timeCell.append(blok, time);
    row.appendChild(timeCell);

    // Day columns (SENIN - MINGGU)
    slot.cells.forEach((items, i) => {
      const td = document.createElement('td');
      td.className = 'sched-prog-cell';
      if (items.length > 0) {
        items.forEach(({ title }) => {
          const pill = document.createElement('div');
          pill.className = 'sched-pill';
          pill.textContent = title;
          pill.title = `${daysList[i]}, ${slot.timeLabel} — ${title}`;
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
