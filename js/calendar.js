/* ==========================================
   SalesFlow Calendar Module (calendar.js)
   ========================================== */
import { store, getRelativeDate } from './store.js';

let currentYear = 2026;
let currentMonth = 5; // June (0-indexed: January is 0, June is 5)

export function initCalendar(onOpenTaskModal) {
    // Set to current date if possible, but default to June 2026 based on metadata
    const localTime = new Date("2026-06-12");
    currentYear = localTime.getFullYear();
    currentMonth = localTime.getMonth();

    renderCalendar(onOpenTaskModal);

    // Setup calendar navigation buttons
    const prevBtn = document.getElementById('cal-prev-month');
    const nextBtn = document.getElementById('cal-next-month');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            renderCalendar(onOpenTaskModal);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            renderCalendar(onOpenTaskModal);
        });
    }

    // Re-render when store updates
    window.addEventListener('store-updated', () => {
        renderCalendar(onOpenTaskModal);
    });

    // Handle global project filter changes
    const filter = document.getElementById('global-project-filter');
    if (filter) {
        filter.addEventListener('change', () => {
            renderCalendar(onOpenTaskModal);
        });
    }
}

function renderCalendar(onOpenTaskModal) {
    const monthYearEl = document.getElementById('calendar-month-year');
    const daysGrid = document.getElementById('calendar-days-grid');
    const scheduleList = document.getElementById('calendar-schedule-list');
    
    if (!monthYearEl || !daysGrid) return;

    // Get current global filter
    const filterSelect = document.getElementById('global-project-filter');
    const activeProject = filterSelect ? filterSelect.value : 'all';

    // Retrieve tasks filtered by project
    const tasks = store.getTasksFiltered({ projectType: activeProject });

    // Set Month Year Title
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    monthYearEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;

    // Clear days grid
    daysGrid.innerHTML = '';

    // Day offset calculations
    const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sun, 6 is Sat
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Injected empty cells for offset
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        daysGrid.appendChild(emptyCell);
    }

    // Today markers
    const today = new Date();
    const isCurrentMonthYear = today.getFullYear() === currentYear && today.getMonth() === currentMonth;
    const todayDate = today.getDate();

    // Inject Days
    for (let day = 1; day <= totalDays; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        if (isCurrentMonthYear && day === todayDate) {
            dayCell.classList.add('today');
        }

        dayCell.innerHTML = `<span class="calendar-day-num">${day}</span><div class="calendar-day-events"></div>`;
        const eventsContainer = dayCell.querySelector('.calendar-day-events');

        // Check tasks for this date
        const currentCellDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        const cellTasks = tasks.filter(task => {
            const hasFollowup = task.followupDate === currentCellDateStr;
            const hasDeadline = task.deadline === currentCellDateStr || task.bniDeadline === currentCellDateStr;
            return hasFollowup || hasDeadline;
        });

        cellTasks.forEach(task => {
            const eventEl = document.createElement('div');
            const isFollowup = task.followupDate === currentCellDateStr;
            
            // Event label styling
            const project = store.getProjectById(task.projectType);
            const templateType = project ? project.templateType : task.projectType;
            let catCode = 'DM';
            if (templateType === 'nable-attendance') catCode = 'Nable';
            else if (templateType === 'bni-tasks') catCode = 'BNI';
            
            eventEl.className = `calendar-event ${catCode}`;
            eventEl.title = `${isFollowup ? 'Follow-up' : 'Deadline'}: ${task.title}`;
            eventEl.textContent = `${isFollowup ? '📞' : '🏁'} ${task.title}`;
            
            eventEl.addEventListener('click', (e) => {
                e.stopPropagation();
                onOpenTaskModal(task.id);
            });

            eventsContainer.appendChild(eventEl);
        });

        daysGrid.appendChild(dayCell);
    }

    // Sidebar: upcoming list this month or general followups
    if (scheduleList) {
        const upcomingTasks = tasks
            .filter(t => t.status !== 'completed' && t.followupDate)
            .sort((a, b) => (a.followupDate || '').localeCompare(b.followupDate || ''));

        if (upcomingTasks.length === 0) {
            scheduleList.innerHTML = `<div class="empty-state">No scheduled follow-ups</div>`;
        } else {
            scheduleList.innerHTML = upcomingTasks.map(task => {
                return `
                    <div class="schedule-item" data-task-id="${task.id}">
                        <div class="title">${task.title}</div>
                        <div class="date-str">📅 Follow-up: ${task.followupDate}</div>
                    </div>
                `;
            }).join('');

            // Click listener
            scheduleList.querySelectorAll('.schedule-item').forEach(el => {
                el.addEventListener('click', () => {
                    onOpenTaskModal(el.dataset.taskId);
                });
            });
        }
    }
}

// RFC 5545 calendar invite exporter
export function downloadICS(task) {
    const title = task.title;
    const desc = task.description || '';
    const dateStr = task.followupDate || task.deadline || task.bniDeadline;
    if (!dateStr) return;

    // Convert YYYY-MM-DD to YYYYMMDD
    const datePart = dateStr.replace(/-/g, '');
    const start = `${datePart}T090000`; // 9:00 AM local
    const end = `${datePart}T100000`;   // 10:00 AM local

    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Antigravity//SalesFlow CRM//EN',
        'BEGIN:VEVENT',
        `UID:salesflow-${task.id}`,
        `DTSTAMP:${datePart}T000000Z`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${title}`,
        `DESCRIPTION:${desc.replace(/\n/g, '\\n')}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `followup-${task.id.toLowerCase()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Generates Google Calendar web integration URL
export function getGoogleCalendarLink(task) {
    const title = task.title;
    const desc = task.description || '';
    const dateStr = task.followupDate || task.deadline || task.bniDeadline;
    if (!dateStr) return '';

    // Convert YYYY-MM-DD to YYYYMMDD
    const datePart = dateStr.replace(/-/g, '');
    const start = `${datePart}T090000`; // 9:00 AM local
    const end = `${datePart}T100000`;   // 10:00 AM local

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Follow-up: ' + title)}&dates=${start}/${end}&details=${encodeURIComponent(desc)}&sf=true&output=xml`;
}

