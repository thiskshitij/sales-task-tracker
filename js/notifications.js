/* ==========================================
   SalesFlow Notifications Module (notifications.js)
   ========================================== */
import { store, getRelativeDate } from './store.js';

let shownSystemNotifs = new Set(); // Track displayed system notifications during session

export function initNotifications(onOpenTaskModal) {
    setupDropdownToggle();
    refreshNotifications(onOpenTaskModal);

    // Refresh on store updates
    window.addEventListener('store-updated', () => {
        refreshNotifications(onOpenTaskModal);
    });

    // Request browser Notification API permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function setupDropdownToggle() {
    const notifBtn = document.getElementById('notif-btn');
    const dropdown = document.getElementById('notif-dropdown');
    const clearBtn = document.getElementById('btn-clear-notifs');

    if (notifBtn && dropdown) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        });

        // Hide dropdown clicking anywhere else
        document.addEventListener('click', () => {
            dropdown.classList.add('hidden');
        });

        dropdown.addEventListener('click', (e) => {
            e.stopPropagation(); // Keep open when clicking inside
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const list = document.getElementById('notif-list-container');
            if (list) {
                list.innerHTML = `<div class="empty-state" style="padding: 16px; font-size:12px;">All alerts cleared</div>`;
            }
            const badge = document.getElementById('notif-badge');
            if (badge) {
                badge.classList.add('hidden');
                badge.textContent = "0";
            }
        });
    }
}

function refreshNotifications(onOpenTaskModal) {
    const listContainer = document.getElementById('notif-list-container');
    const badge = document.getElementById('notif-badge');
    if (!listContainer) return;

    const tasks = store.getAllTasks().filter(t => t.status !== 'completed');
    const todayStr = getRelativeDate(0);

    const alerts = [];

    tasks.forEach(task => {
        // 1. Follow-up today or overdue
        if (task.followupDate) {
            if (task.followupDate === todayStr) {
                alerts.push({
                    type: 'followup',
                    taskId: task.id,
                    title: `Follow-up Today`,
                    body: `${task.title} requires contact today.`,
                    time: 'Today'
                });
                triggerSystemNotification(task.id, 'Follow-up Today', `${task.title} is scheduled for follow-up today.`);
            } else if (task.followupDate < todayStr) {
                alerts.push({
                    type: 'followup',
                    taskId: task.id,
                    title: `Overdue Follow-up`,
                    body: `Missed follow-up on ${task.followupDate} for ${task.title}.`,
                    time: 'Overdue'
                });
            }
        }

        // 2. Deadlines today or overdue
        const deadline = task.deadline || task.bniDeadline;
        if (deadline) {
            if (deadline === todayStr) {
                alerts.push({
                    type: 'deadline',
                    taskId: task.id,
                    title: `Deadline Today`,
                    body: `${task.title} is due today!`,
                    time: 'Due Today'
                });
                triggerSystemNotification(task.id, 'Deadline Today', `${task.title} is due today!`);
            } else if (deadline < todayStr) {
                alerts.push({
                    type: 'deadline',
                    taskId: task.id,
                    title: `Overdue Task`,
                    body: `${task.title} has passed its deadline (${deadline})!`,
                    time: 'Overdue'
                });
            }
        }

        // 3. Blockers
        if (task.hasDependency) {
            alerts.push({
                type: 'blocker',
                taskId: task.id,
                title: `Blocked Task`,
                body: `${task.title} is blocked by ${task.dependencyPerson}.`,
                time: 'Blocked'
            });
        }
    });

    // Render alerts in list
    if (alerts.length === 0) {
        listContainer.innerHTML = `<div class="empty-state" style="padding: 24px; font-size:12px;">No active alerts</div>`;
        if (badge) {
            badge.classList.add('hidden');
            badge.textContent = "0";
        }
    } else {
        if (badge) {
            badge.classList.remove('hidden');
            badge.textContent = alerts.length;
        }

        listContainer.innerHTML = alerts.map(alert => {
            let icon = 'notifications';
            if (alert.type === 'followup') icon = 'phone_in_talk';
            else if (alert.type === 'deadline') icon = 'event_busy';
            else if (alert.type === 'blocker') icon = 'report_problem';

            return `
                <div class="notif-item unread ${alert.type}" data-task-id="${alert.taskId}">
                    <span class="material-symbols-outlined notif-icon">${icon}</span>
                    <div class="notif-item-body">
                        <span style="font-weight:600;">${alert.title}</span>
                        <span>${alert.body}</span>
                        <span class="notif-item-time">${alert.time}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Register clicks
        listContainer.querySelectorAll('.notif-item').forEach(el => {
            el.addEventListener('click', () => {
                const dropdown = document.getElementById('notif-dropdown');
                if (dropdown) dropdown.classList.add('hidden');
                onOpenTaskModal(el.dataset.taskId);
            });
        });
    }
}

function triggerSystemNotification(taskId, title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notifKey = `${taskId}-${title}`;
        if (!shownSystemNotifs.has(notifKey)) {
            shownSystemNotifs.add(notifKey);
            new Notification(`SalesFlow: ${title}`, {
                body: body,
                icon: 'https://cdn-icons-png.flaticon.com/512/3239/3239045.png' // Generic calendar bell icon link
            });
        }
    }
}
