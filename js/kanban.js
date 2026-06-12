/* ==========================================
   SalesFlow Kanban Board Module (kanban.js)
   ========================================== */
import { store } from './store.js';

export function initKanban(onOpenTaskModal) {
    renderKanban(onOpenTaskModal);

    // Re-render when store updates
    window.addEventListener('store-updated', () => {
        renderKanban(onOpenTaskModal);
    });

    // Handle global project filter changes
    const filter = document.getElementById('global-project-filter');
    if (filter) {
        filter.addEventListener('change', () => {
            renderKanban(onOpenTaskModal);
        });
    }

    // Handle global search input changes
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderKanban(onOpenTaskModal);
        });
    }
}

function renderKanban(onOpenTaskModal) {
    const kanbanWrapper = document.querySelector('.kanban-wrapper');
    if (!kanbanWrapper) return;

    // Get current global filter
    const filterSelect = document.getElementById('global-project-filter');
    const activeProject = filterSelect ? filterSelect.value : 'all';

    // Get search term
    const searchInput = document.getElementById('global-search');
    const search = searchInput ? searchInput.value : '';

    // Retrieve tasks filtered by project
    const tasks = store.getTasksFiltered({ projectType: activeProject, search });

    // Define columns
    const columns = [
        { id: 'not-started', title: 'Not Started', color: 'var(--text-muted)' },
        { id: 'in-progress', title: 'In Progress', color: 'var(--color-primary)' },
        { id: 'on-hold', title: 'On Hold', color: 'var(--color-warning)' },
        { id: 'completed', title: 'Completed', color: 'var(--color-success)' }
    ];

    kanbanWrapper.innerHTML = '';

    columns.forEach(col => {
        const colTasks = tasks.filter(t => t.status === col.id);
        const colEl = document.createElement('div');
        colEl.className = 'kanban-column';
        colEl.innerHTML = `
            <div class="kanban-column-header">
                <div class="kanban-column-title" style="color: ${col.color}">
                    <span class="material-symbols-outlined">${getColIcon(col.id)}</span>
                    <span>${col.title}</span>
                </div>
                <span class="kanban-task-count">${colTasks.length}</span>
            </div>
            <div class="kanban-tasks-list" data-status="${col.id}">
                <!-- Cards will go here -->
            </div>
        `;

        const taskListContainer = colEl.querySelector('.kanban-tasks-list');

        if (colTasks.length === 0) {
            taskListContainer.innerHTML = `<div class="empty-state" style="padding: 10px; font-size: 11px;">Empty column</div>`;
        } else {
            colTasks.forEach(task => {
                const card = createTaskCard(task);
                taskListContainer.appendChild(card);
            });
        }

        // Setup drop zones
        setupDropZone(taskListContainer);

        kanbanWrapper.appendChild(colEl);
    });

    // Add click listeners to edit tasks
    kanbanWrapper.querySelectorAll('.kanban-task-card').forEach(el => {
        el.addEventListener('click', (e) => {
            // Prevent triggering on card buttons or child handles
            onOpenTaskModal(el.dataset.taskId);
        });
    });
}

function getColIcon(status) {
    switch (status) {
        case 'not-started': return 'circle';
        case 'in-progress': return 'pending';
        case 'on-hold': return 'pause_circle';
        case 'completed': return 'check_circle';
        default: return 'circle';
    }
}

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'kanban-task-card';
    card.setAttribute('draggable', 'true');
    card.dataset.taskId = task.id;

    // Determine visual details
    const priorityColor = task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'success';
    
    // Project tag
    const project = store.getProjectById(task.projectType);
    const templateType = project ? project.templateType : task.projectType;
    const projLabel = project ? (project.name.length > 8 ? project.name.substring(0, 8) + '..' : project.name) : 'Task';
    
    let projColor = 'info';
    if (templateType === 'nable-attendance') projColor = 'purple';
    else if (templateType === 'bni-tasks') projColor = 'warning';

    // Sub-details based on project
    let metaHTML = '';
    if (templateType === 'digital-marketing') {
        metaHTML = `<div>📋 Sub: ${task.subproject || ''}</div>`;
        if (task.clientName) metaHTML += `<div>👤 Client: ${task.clientName}</div>`;
    } else if (templateType === 'nable-attendance') {
        metaHTML = `<div>📈 Status: ${task.leadStatus || ''}</div>`;
        if (task.contactPerson) metaHTML += `<div>👤 Contact: ${task.contactPerson.split(' ')[0]}</div>`;
    } else if (templateType === 'bni-tasks') {
        if (task.bniAssignedBy) metaHTML += `<div>👤 By: ${task.bniAssignedBy}</div>`;
    }

    // Blocker label
    const blockerHTML = task.hasDependency 
        ? `<div class="badge danger" style="padding: 2px 4px; font-size: 8px; align-self: flex-start; margin-top: 4px;">⚠️ BLOCKER</div>`
        : '';

    // Date label (deadline or followup)
    let dateHTML = '';
    if (task.followupDate) {
        dateHTML = `📅 Follow: ${task.followupDate}`;
    } else if (task.deadline) {
        dateHTML = `🏁 Due: ${task.deadline}`;
    } else if (task.bniDeadline) {
        dateHTML = `🏁 Due: ${task.bniDeadline}`;
    }

    card.innerHTML = `
        <div class="task-card-header">
            <span class="task-card-title">${task.title}</span>
            <span class="badge ${priorityColor}" style="font-size: 8px;">${task.priority}</span>
        </div>
        <div class="task-card-meta">
            ${metaHTML}
            ${blockerHTML}
        </div>
        <div class="task-card-footer">
            <span class="badge ${projColor}" style="font-size: 8px; font-weight: 500;">${projLabel}</span>
            <span class="task-card-avatars">${dateHTML}</span>
        </div>
    `;

    // Drag events on card
    card.addEventListener('dragstart', (e) => {
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', task.id);
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
    });

    return card;
}

function setupDropZone(container) {
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        container.style.background = 'rgba(255, 255, 255, 0.03)';
    });

    container.addEventListener('dragleave', () => {
        container.style.background = 'transparent';
    });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        container.style.background = 'transparent';
        const taskId = e.dataTransfer.getData('text/plain');
        const task = store.getTaskById(taskId);
        const newStatus = container.dataset.status;

        if (task && task.status !== newStatus) {
            // Update status & save task
            const updatedData = { ...task, status: newStatus };
            // Record progress log about drag drop
            updatedData.progressLog = `Moved status to '${newStatus}' via drag & drop.`;
            store.saveTask(updatedData);
        }
    });
}
