/* ==========================================
   SalesFlow Table View Module (table.js)
   ========================================== */
import { store } from './store.js';

let currentSortField = 'id';
let currentSortOrder = 'asc'; // 'asc' or 'desc'

export function initTable(onOpenTaskModal) {
    renderTable(onOpenTaskModal);

    // Re-render when store updates
    window.addEventListener('store-updated', () => {
        renderTable(onOpenTaskModal);
    });

    // Add filter change listeners
    const globalFilter = document.getElementById('global-project-filter');
    const priorityFilter = document.getElementById('priority-filter');
    const statusFilter = document.getElementById('status-filter');
    const searchInput = document.getElementById('global-search');

    [globalFilter, priorityFilter, statusFilter].forEach(el => {
        if (el) el.addEventListener('change', () => renderTable(onOpenTaskModal));
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => renderTable(onOpenTaskModal));
    }
}

function renderTable(onOpenTaskModal) {
    const tableElement = document.getElementById('tasks-table');
    const tbody = document.getElementById('tasks-table-body');
    if (!tableElement || !tbody) return;

    // Get filter states
    const globalFilter = document.getElementById('global-project-filter');
    const priorityFilter = document.getElementById('priority-filter');
    const statusFilter = document.getElementById('status-filter');
    const searchInput = document.getElementById('global-search');

    const projectType = globalFilter ? globalFilter.value : 'all';
    const priority = priorityFilter ? priorityFilter.value : 'all';
    const status = statusFilter ? statusFilter.value : 'all';
    const search = searchInput ? searchInput.value : '';

    // Fetch and filter tasks
    let tasks = store.getTasksFiltered({ projectType, priority, status, search });

    // Apply sorting
    tasks = sortTasks(tasks, currentSortField, currentSortOrder);

    // Setup headers dynamically
    setupHeaders(tableElement, projectType, onOpenTaskModal);

    tbody.innerHTML = '';

    if (tasks.length === 0) {
        // Calculate colSpan based on active headers
        const colSpan = tableElement.querySelectorAll('thead th').length;
        tbody.innerHTML = `<tr><td colspan="${colSpan}"><div class="empty-state">No matching tasks or leads found.</div></td></tr>`;
        return;
    }

    tasks.forEach((task, index) => {
        const row = document.createElement('tr');
        row.dataset.taskId = task.id;
        row.innerHTML = getRowHTML(task, index + 1, projectType);
        
        row.addEventListener('click', () => {
            onOpenTaskModal(task.id);
        });
        tbody.appendChild(row);
    });
}

function setupHeaders(tableEl, projectType, onOpenTaskModal) {
    const thead = tableEl.querySelector('thead');
    if (!thead) return;

    const project = store.getProjectById(projectType);
    const templateType = project ? project.templateType : projectType;

    let headers = [];
    
    if (templateType === 'digital-marketing') {
        headers = [
            { field: 'sr_no', label: 'Sr. No.' },
            { field: 'title', label: 'Project Name' },
            { field: 'clientName', label: 'Client Name' },
            { field: 'subproject', label: 'Segregation' },
            { field: 'startDate', label: 'Start Date' },
            { field: 'deadline', label: 'Deadline' },
            { field: 'currentStage', label: 'Current Stage' },
            { field: 'status', label: 'Status' },
            { field: 'priority', label: 'Priority' },
            { field: 'hasDependency', label: 'Blockers' },
            { field: 'assignedTo', label: 'Assigned To' },
            { field: 'nextAction', label: 'Next Action' }
        ];
    } else if (templateType === 'nable-attendance') {
        headers = [
            { field: 'sr_no', label: 'Sr. No.' },
            { field: 'title', label: 'Lead / School Name' },
            { field: 'leadStatus', label: 'Lead Status' },
            { field: 'demoStage', label: 'Demo' },
            { field: 'followupDate', label: 'Followup Date' },
            { field: 'installed', label: 'Installed?' },
            { field: 'contactPerson', label: 'Contact Person' },
            { field: 'billingDetails', label: 'Billing details' },
            { field: 'status', label: 'Status' },
            { field: 'priority', label: 'Priority' },
            { field: 'assignedTo', label: 'Assigned' }
        ];
    } else if (templateType === 'bni-tasks') {
        headers = [
            { field: 'sr_no', label: 'Sr. No.' },
            { field: 'title', label: 'BNI Task Details' },
            { field: 'bniMeetingDate', label: 'Meeting Date' },
            { field: 'bniDeadline', label: 'Deadline' },
            { field: 'bniAssignedBy', label: 'Assigned By' },
            { field: 'bniReferral', label: 'Referral details' },
            { field: 'status', label: 'Status' },
            { field: 'priority', label: 'Priority' },
            { field: 'tags', label: 'Tags' },
            { field: 'assignedTo', label: 'Assigned To' }
        ];
    } else {
        // 'all' project types view
        headers = [
            { field: 'sr_no', label: 'Sr. No.' },
            { field: 'projectType', label: 'Category' },
            { field: 'title', label: 'Task Name' },
            { field: 'status', label: 'Status' },
            { field: 'priority', label: 'Priority' },
            { field: 'followupDate', label: 'Followup' },
            { field: 'deadline', label: 'Deadline' },
            { field: 'hasDependency', label: 'Blockers' },
            { field: 'assignedTo', label: 'Assigned To' }
        ];
    }

    thead.innerHTML = '<tr>' + headers.map(h => {
        const sortIcon = currentSortField === h.field 
            ? (currentSortOrder === 'asc' ? ' 🔼' : ' 🔽') 
            : '';
        const isSortable = h.field !== 'sr_no';
        return `
            <th data-field="${h.field}" style="${isSortable ? 'cursor:pointer;' : ''}">
                ${h.label}${sortIcon}
            </th>
        `;
    }).join('') + '</tr>';

    // Add click sorting listeners
    thead.querySelectorAll('th').forEach(th => {
        const field = th.dataset.field;
        if (field && field !== 'sr_no') {
            th.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentSortField === field) {
                    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortField = field;
                    currentSortOrder = 'asc';
                }
                renderTable(onOpenTaskModal);
            });
        }
    });
}

function getRowHTML(task, srNo, viewMode) {
    const statusLabels = {
        'not-started': 'Not Started',
        'in-progress': 'In Progress',
        'on-hold': 'On Hold',
        'completed': 'Completed'
    };

    // Format priorities
    const prioBadge = task.priority === 'high' 
        ? `<span class="badge danger">🔴 High</span>`
        : task.priority === 'medium' ? `<span class="badge warning">🟡 Med</span>` : `<span class="badge success">🟢 Low</span>`;

    // Format status
    const statusBadge = task.status === 'completed'
        ? `<span class="badge success">Completed</span>`
        : task.status === 'in-progress'
            ? `<span class="badge info">In Progress</span>`
            : task.status === 'on-hold' ? `<span class="badge warning">On Hold</span>` : `<span class="badge info" style="background:rgba(255,255,255,0.05); color:var(--text-muted);">Not Started</span>`;

    // Blocker status
    const blockerIndicator = task.hasDependency 
        ? `<span class="badge danger" title="${task.dependencyPerson}: ${task.dependencyIssue}">⚠️ Blocker</span>`
        : `<span class="badge success" style="background:rgba(63, 185, 80, 0.05);">None</span>`;

    const project = store.getProjectById(viewMode);
    const templateType = project ? project.templateType : viewMode;

    if (templateType === 'digital-marketing') {
        return `
            <td>${srNo}</td>
            <td style="font-weight:600; color:var(--text-main);">${task.title}</td>
            <td>${task.clientName || '-'}</td>
            <td><span class="badge info">${task.subproject || 'Marketing'}</span></td>
            <td>${task.startDate || '-'}</td>
            <td>${task.deadline || '-'}</td>
            <td>${task.currentStage || '-'}</td>
            <td>${statusBadge}</td>
            <td>${prioBadge}</td>
            <td>${blockerIndicator}</td>
            <td>${task.assignedTo || 'Unassigned'}</td>
            <td>${task.nextAction || '-'}</td>
        `;
    } else if (templateType === 'nable-attendance') {
        const installBadge = task.installed === 'Yes' 
            ? `<span class="badge success">Yes</span>` 
            : `<span class="badge danger">No</span>`;
        return `
            <td>${srNo}</td>
            <td style="font-weight:600; color:var(--text-main);">${task.title}</td>
            <td><span class="badge purple">${task.leadStatus || 'Lead'}</span></td>
            <td>${task.demoStage || 'None'}</td>
            <td>${task.followupDate || '-'}</td>
            <td>${installBadge}</td>
            <td>${task.contactPerson || '-'}</td>
            <td>${task.billingDetails || '-'}</td>
            <td>${statusBadge}</td>
            <td>${prioBadge}</td>
            <td>${task.assignedTo || 'Unassigned'}</td>
        `;
    } else if (templateType === 'bni-tasks') {
        const tagsHTML = (task.tags || []).map(t => `<span class="badge info" style="padding: 2px 4px; font-size: 9px; background: rgba(88,166,255,0.08);">${t}</span>`).join(' ');
        return `
            <td>${srNo}</td>
            <td style="font-weight:600; color:var(--text-main);">${task.title}</td>
            <td>${task.bniMeetingDate || '-'}</td>
            <td>${task.bniDeadline || '-'}</td>
            <td>${task.bniAssignedBy || '-'}</td>
            <td>${task.bniReferral || '-'}</td>
            <td>${statusBadge}</td>
            <td>${prioBadge}</td>
            <td>${tagsHTML || '-'}</td>
            <td>${task.assignedTo || 'Unassigned'}</td>
        `;
    } else {
        // generic 'all' view
        const taskProj = store.getProjectById(task.projectType);
        const taskTemplate = taskProj ? taskProj.templateType : task.projectType;
        const catLabel = taskProj ? (taskProj.name.length > 8 ? taskProj.name.substring(0, 8) + '..' : taskProj.name) : 'Task';
        
        let catColor = 'info';
        if (taskTemplate === 'nable-attendance') catColor = 'purple';
        else if (taskTemplate === 'bni-tasks') catColor = 'warning';

        return `
            <td>${srNo}</td>
            <td><span class="badge ${catColor}">${catLabel}</span></td>
            <td style="font-weight:600; color:var(--text-main);">${task.title}</td>
            <td>${statusBadge}</td>
            <td>${prioBadge}</td>
            <td>${task.followupDate || '-'}</td>
            <td>${task.deadline || task.bniDeadline || '-'}</td>
            <td>${blockerIndicator}</td>
            <td>${task.assignedTo || 'Unassigned'}</td>
        `;
    }
}

function sortTasks(tasks, field, order) {
    if (field === 'sr_no') return tasks;

    return [...tasks].sort((a, b) => {
        let valA = a[field];
        let valB = b[field];

        // Normalise fields
        if (field === 'deadline') {
            valA = a.deadline || a.bniDeadline || '';
            valB = b.deadline || b.bniDeadline || '';
        }

        // Handle string comparison safely
        if (typeof valA === 'string') {
            return order === 'asc' 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        } else if (typeof valA === 'boolean') {
            return order === 'asc' 
                ? (valA === valB ? 0 : valA ? 1 : -1) 
                : (valA === valB ? 0 : valA ? -1 : 1);
        } else {
            // Numbers or undefined/null
            valA = valA || 0;
            valB = valB || 0;
            return order === 'asc' ? valA - valB : valB - valA;
        }
    });
}

export function exportTableToCSV() {
    // Get filter states
    const globalFilter = document.getElementById('global-project-filter');
    const priorityFilter = document.getElementById('priority-filter');
    const statusFilter = document.getElementById('status-filter');
    const searchInput = document.getElementById('global-search');

    const projectType = globalFilter ? globalFilter.value : 'all';
    const priority = priorityFilter ? priorityFilter.value : 'all';
    const status = statusFilter ? statusFilter.value : 'all';
    const search = searchInput ? searchInput.value : '';

    // Fetch and filter tasks
    let tasks = store.getTasksFiltered({ projectType, priority, status, search });
    tasks = sortTasks(tasks, currentSortField, currentSortOrder);

    const project = store.getProjectById(projectType);
    const templateType = project ? project.templateType : projectType;

    let headers = [];
    let rowMapper = null;

    if (templateType === 'digital-marketing') {
        headers = ['Sr. No.', 'Project Name', 'Client Name', 'Segregation', 'Start Date', 'Deadline', 'Current Stage', 'Status', 'Priority', 'Blockers', 'Assigned To', 'Next Action'];
        rowMapper = (t, idx) => [
            idx + 1,
            t.title,
            t.clientName || '',
            t.subproject || 'Marketing',
            t.startDate || '',
            t.deadline || '',
            t.currentStage || '',
            t.status,
            t.priority,
            t.hasDependency ? `Yes (${t.dependencyPerson}: ${t.dependencyIssue})` : 'No',
            t.assignedTo || 'Unassigned',
            t.nextAction || ''
        ];
    } else if (templateType === 'nable-attendance') {
        headers = ['Sr. No.', 'Lead / School Name', 'Lead Status', 'Demo', 'Followup Date', 'Installed?', 'Contact Person', 'Billing details', 'Status', 'Priority', 'Assigned'];
        rowMapper = (t, idx) => [
            idx + 1,
            t.title,
            t.leadStatus || 'Lead',
            t.demoStage || 'None',
            t.followupDate || '',
            t.installed || 'No',
            t.contactPerson || '',
            t.billingDetails || '',
            t.status,
            t.priority,
            t.assignedTo || 'Unassigned'
        ];
    } else if (templateType === 'bni-tasks') {
        headers = ['Sr. No.', 'BNI Task Details', 'Meeting Date', 'Deadline', 'Assigned By', 'Referral details', 'Status', 'Priority', 'Tags', 'Assigned To'];
        rowMapper = (t, idx) => [
            idx + 1,
            t.title,
            t.bniMeetingDate || '',
            t.bniDeadline || '',
            t.bniAssignedBy || '',
            t.bniReferral || '',
            t.status,
            t.priority,
            (t.tags || []).join(', '),
            t.assignedTo || 'Unassigned'
        ];
    } else {
        // 'all'
        headers = ['Sr. No.', 'Category', 'Task Name', 'Status', 'Priority', 'Followup', 'Deadline', 'Blockers', 'Assigned To'];
        rowMapper = (t, idx) => {
            const taskProj = store.getProjectById(t.projectType);
            const catLabel = taskProj ? taskProj.name : t.projectType;
            return [
                idx + 1,
                catLabel,
                t.title,
                t.status,
                t.priority,
                t.followupDate || '',
                t.deadline || t.bniDeadline || '',
                t.hasDependency ? `Yes (${t.dependencyPerson}: ${t.dependencyIssue})` : 'No',
                t.assignedTo || 'Unassigned'
            ];
        };
    }

    // Generate CSV contents
    const escapeCSV = (val) => {
        const str = String(val === undefined || val === null ? '' : val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const csvRows = [];
    csvRows.push(headers.map(escapeCSV).join(','));
    tasks.forEach((t, idx) => {
        csvRows.push(rowMapper(t, idx).map(escapeCSV).join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `salesflow_export_${projectType}_${dateStr}.csv`;

    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
