/* ==========================================
   SalesFlow Dashboard Module (dashboard.js)
   ========================================== */
import { store, getRelativeDate } from './store.js';

export function initDashboard(onOpenTaskModal) {
    renderCounters();
    renderCharts();
    renderRemindersAndBlockers(onOpenTaskModal);

    // Re-render when store updates
    window.addEventListener('store-updated', () => {
        renderCounters();
        renderCharts();
        renderRemindersAndBlockers(onOpenTaskModal);
    });
}

function renderCounters() {
    const tasks = store.getAllTasks();
    const todayStr = getRelativeDate(0);
    
    // Calculations
    const activeTasks = tasks.filter(t => t.status !== 'completed');
    const followupTodayCount = activeTasks.filter(t => t.followupDate && t.followupDate <= todayStr).length;
    const openTasksCount = activeTasks.length;
    const blockersCount = activeTasks.filter(t => t.hasDependency).length;
    
    // Completion Rate
    const totalCount = tasks.length;
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const countersContainer = document.getElementById('dashboard-counters');
    if (!countersContainer) return;

    countersContainer.innerHTML = `
        <div class="card glass stat-card">
            <div class="stat-card-icon" style="background: rgba(88, 166, 255, 0.1); color: var(--color-primary);">
                <span class="material-symbols-outlined">assignment_turned_in</span>
            </div>
            <div class="stat-card-info">
                <span class="label">Completion Rate</span>
                <span class="value">${completionRate}%</span>
            </div>
        </div>
        <div class="card glass stat-card">
            <div class="stat-card-icon" style="background: rgba(212, 153, 34, 0.1); color: var(--color-warning);">
                <span class="material-symbols-outlined">notification_important</span>
            </div>
            <div class="stat-card-info">
                <span class="label">Due Follow-ups</span>
                <span class="value">${followupTodayCount}</span>
            </div>
        </div>
        <div class="card glass stat-card">
            <div class="stat-card-icon" style="background: rgba(188, 140, 255, 0.1); color: var(--color-purple);">
                <span class="material-symbols-outlined">assignment</span>
            </div>
            <div class="stat-card-info">
                <span class="label">Open Tasks</span>
                <span class="value">${openTasksCount}</span>
            </div>
        </div>
        <div class="card glass stat-card">
            <div class="stat-card-icon" style="background: rgba(248, 81, 73, 0.1); color: var(--color-danger);">
                <span class="material-symbols-outlined">running_with_errors</span>
            </div>
            <div class="stat-card-info">
                <span class="label">Active Blockers</span>
                <span class="value">${blockersCount}</span>
            </div>
        </div>
    `;

    // Update sidebar indicator too
    const miniCounter = document.getElementById('mini-followups-count');
    if (miniCounter) {
        miniCounter.textContent = followupTodayCount;
    }
}

function renderCharts() {
    renderProgressChart();
    renderPriorityDonutChart();
    renderFunnelChart();
}

function renderProgressChart() {
    const container = document.getElementById('progress-chart-container');
    if (!container) return;

    const tasks = store.getAllTasks();
    const workspaces = store.getProjects();
    
    // Group status counts by workspace ID
    const projectsData = {};
    workspaces.forEach(w => {
        projectsData[w.id] = {
            name: w.name,
            notStarted: 0,
            inProgress: 0,
            completed: 0
        };
    });

    tasks.forEach(t => {
        const projId = t.projectType;
        if (projectsData[projId]) {
            if (t.status === 'completed') {
                projectsData[projId].completed++;
            } else if (t.status === 'in-progress') {
                projectsData[projId].inProgress++;
            } else {
                projectsData[projId].notStarted++;
            }
        } else {
            // Legacy/fallback project mapping
            const fallbackProj = workspaces[0];
            if (fallbackProj && projectsData[fallbackProj.id]) {
                if (t.status === 'completed') {
                    projectsData[fallbackProj.id].completed++;
                } else if (t.status === 'in-progress') {
                    projectsData[fallbackProj.id].inProgress++;
                } else {
                    projectsData[fallbackProj.id].notStarted++;
                }
            }
        }
    });

    // If there are no workspaces, render a clean empty state
    if (workspaces.length === 0) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 13px; padding-bottom: 24px;">
                <span class="material-symbols-outlined" style="font-size: 36px; margin-bottom: 8px;">analytics</span>
                <span>No projects or tasks found</span>
            </div>
        `;
        return;
    }

    let barsHTML = '';
    const maxVal = Math.max(
        ...workspaces.map(w => projectsData[w.id].notStarted + projectsData[w.id].inProgress + projectsData[w.id].completed), 
        3 // Fallback min height scale
    );
    
    // Calculate chart width dynamically. 80px per workspace + margins.
    const chartWidth = Math.max(450, 60 + workspaces.length * 100);

    workspaces.forEach((w, index) => {
        const stats = projectsData[w.id];
        const total = stats.notStarted + stats.inProgress + stats.completed;
        
        // Coordinates: starting at x=50, separated by 100px intervals
        const x = 50 + index * 100;
        const scale = 160 / maxVal;
        
        // Heights
        const hCompleted = stats.completed * scale;
        const hInProgress = stats.inProgress * scale;
        const hNotStarted = stats.notStarted * scale;
        
        // Stack bars
        const yCompleted = 200 - hCompleted;
        const yInProgress = yCompleted - hInProgress;
        const yNotStarted = yInProgress - hNotStarted;
        
        // Truncate names to prevent chart overlap, show full name on hover via <title>
        const displayName = w.name.length > 12 ? w.name.substring(0, 10) + '...' : w.name;
        
        barsHTML += `
            <!-- Grid Line -->
            <line class="chart-grid-line" x1="${x + 20}" y1="40" x2="${x + 20}" y2="200"></line>
            
            <!-- Stacked Bar Groups -->
            <g style="cursor: pointer;">
                <title>${w.name}: ${stats.completed} Completed, ${stats.inProgress} In Progress, ${stats.notStarted} Pending</title>
                ${stats.completed > 0 ? `<rect class="chart-bar" x="${x}" y="${yCompleted}" width="40" height="${hCompleted}" fill="var(--color-success)" rx="2"></rect>` : ''}
                ${stats.inProgress > 0 ? `<rect class="chart-bar" x="${x}" y="${yInProgress}" width="40" height="${hInProgress}" fill="var(--color-primary)" rx="2"></rect>` : ''}
                ${stats.notStarted > 0 ? `<rect class="chart-bar" x="${x}" y="${yNotStarted}" width="40" height="${hNotStarted}" fill="var(--text-muted)" rx="2"></rect>` : ''}
            </g>
            
            <!-- Axis label -->
            <text class="chart-text" x="${x + 20}" y="220" text-anchor="middle" font-size="10" fill="var(--text-muted)">${displayName}</text>
            <text class="chart-text" x="${x + 20}" y="${yNotStarted - 6}" text-anchor="middle" font-weight="600" fill="var(--text-main)" font-size="11">${total}</text>
        `;
    });

    container.innerHTML = `
        <svg class="svg-chart" viewBox="0 0 ${chartWidth} 240" style="width: ${chartWidth}px; min-width: 100%;">
            <!-- Grid Lines Horizontal -->
            <line class="chart-grid-line" x1="40" y1="40" x2="${chartWidth - 20}" y2="40"></line>
            <line class="chart-grid-line" x1="40" y1="93" x2="${chartWidth - 20}" y2="93"></line>
            <line class="chart-grid-line" x1="40" y1="146" x2="${chartWidth - 20}" y2="146"></line>
            <line class="chart-grid-line" x1="40" y1="200" x2="${chartWidth - 20}" y2="200"></line>
            
            <!-- Y-Axis Scale Values -->
            <text class="chart-text" x="30" y="44" text-anchor="end">${maxVal}</text>
            <text class="chart-text" x="30" y="123" text-anchor="end">${Math.round(maxVal / 2)}</text>
            <text class="chart-text" x="30" y="204" text-anchor="end">0</text>
            
            ${barsHTML}
            
            <!-- X-Axis Line -->
            <line class="chart-axis" x1="40" y1="200" x2="${chartWidth - 20}" y2="200"></line>
        </svg>
        
        <!-- Interactive Chart Legends -->
        <div style="position: absolute; bottom: 8px; right: 12px; display: flex; gap: 12px; font-size: 10px;">
            <div style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:8px; height:8px; border-radius:2px; background:var(--color-success);"></span>Completed</div>
            <div style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:8px; height:8px; border-radius:2px; background:var(--color-primary);"></span>In Progress</div>
            <div style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:8px; height:8px; border-radius:2px; background:var(--text-muted);"></span>Pending</div>
        </div>
    `;
}

function renderPriorityDonutChart() {
    const container = document.getElementById('priority-chart-container');
    if (!container) return;

    const tasks = store.getAllTasks().filter(t => t.status !== 'completed');
    
    let high = 0, medium = 0, low = 0;
    tasks.forEach(t => {
        if (t.priority === 'high') high++;
        else if (t.priority === 'medium') medium++;
        else low++;
    });

    const total = high + medium + low;
    
    if (total === 0) {
        container.innerHTML = `<div class="empty-state">No active tasks. All done!</div>`;
        return;
    }

    // Donut math
    const radius = 50;
    const circumference = 2 * Math.PI * radius; // ~314.159
    
    const pctHigh = high / total;
    const pctMedium = medium / total;
    const pctLow = low / total;
    
    const strokeHigh = pctHigh * circumference;
    const strokeMedium = pctMedium * circumference;
    const strokeLow = pctLow * circumference;
    
    // Stroke offsets
    const offsetHigh = 0;
    const offsetMedium = strokeHigh;
    const offsetLow = strokeHigh + strokeMedium;

    container.innerHTML = `
        <svg width="120" height="120" viewBox="0 0 120 120" style="transform: rotate(-90deg);">
            <!-- Donut Segments -->
            ${low > 0 ? `
            <circle class="donut-segment" cx="60" cy="60" r="${radius}" 
                    stroke="var(--color-success)" 
                    stroke-dasharray="${strokeLow} ${circumference - strokeLow}" 
                    stroke-dashoffset="-${offsetLow}"></circle>` : ''}
            
            ${medium > 0 ? `
            <circle class="donut-segment" cx="60" cy="60" r="${radius}" 
                    stroke="var(--color-warning)" 
                    stroke-dasharray="${strokeMedium} ${circumference - strokeMedium}" 
                    stroke-dashoffset="-${offsetMedium}"></circle>` : ''}
            
            ${high > 0 ? `
            <circle class="donut-segment" cx="60" cy="60" r="${radius}" 
                    stroke="var(--color-danger)" 
                    stroke-dasharray="${strokeHigh} ${circumference - strokeHigh}" 
                    stroke-dashoffset="-${offsetHigh}"></circle>` : ''}
            
            <!-- Center label hole -->
            <circle cx="60" cy="60" r="38" fill="var(--bg-glass)"></circle>
            
            <!-- Text (Re-rotated back to normal) -->
            <g style="transform: rotate(90deg) translate(0px, -114px);">
                <text class="donut-center-text" x="60" y="52" font-size="16" font-weight="700">${total}</text>
                <text class="donut-center-text" x="60" y="66" font-size="9" fill="var(--text-muted)" font-weight="500">ACTIVE</text>
            </g>
        </svg>
        
        <div class="donut-legend">
            <div class="donut-legend-item">
                <span class="donut-color-dot" style="background:var(--color-danger)"></span>
                <span>High (${high})</span>
            </div>
            <div class="donut-legend-item">
                <span class="donut-color-dot" style="background:var(--color-warning)"></span>
                <span>Medium (${medium})</span>
            </div>
            <div class="donut-legend-item">
                <span class="donut-color-dot" style="background:var(--color-success)"></span>
                <span>Low (${low})</span>
            </div>
        </div>
    `;
}

function renderRemindersAndBlockers(onOpenTaskModal) {
    const tasks = store.getAllTasks().filter(t => t.status !== 'completed');
    const todayStr = getRelativeDate(0);
    
    // 1. Followups: due today or overdue
    const dueFollowups = tasks.filter(t => t.followupDate && t.followupDate <= todayStr)
                              .sort((a, b) => (a.followupDate || '').localeCompare(b.followupDate || ''));

    const reminderList = document.getElementById('dashboard-reminders-list');
    const reminderBadge = document.getElementById('upcoming-reminders-count');
    
    if (reminderList) {
        if (dueFollowups.length === 0) {
            reminderList.innerHTML = `<div class="empty-state">No follow-ups today. Great job!</div>`;
            if (reminderBadge) reminderBadge.className = "badge success";
            if (reminderBadge) reminderBadge.textContent = "0 Alert(s)";
        } else {
            if (reminderBadge) reminderBadge.className = "badge warning";
            if (reminderBadge) reminderBadge.textContent = `${dueFollowups.length} Alert(s)`;
            
            reminderList.innerHTML = dueFollowups.map(task => {
                const isOverdue = task.followupDate < todayStr;
                const dateBadge = isOverdue 
                    ? `<span class="badge danger" style="padding: 2px 6px;">Overdue: ${task.followupDate}</span>`
                    : `<span class="badge warning" style="padding: 2px 6px;">Today</span>`;
                
                const proj = store.getProjectById(task.projectType);
                const template = proj ? proj.templateType : 'digital-marketing';
                const projLabel = proj ? proj.name.substring(0, 8) : 'Task';
                
                const clientInfo = template === 'nable-attendance'
                    ? task.contactPerson || 'Lead'
                    : task.clientName || 'Client';

                return `
                    <div class="feed-item" data-task-id="${task.id}">
                        <div class="feed-item-left">
                            <div class="feed-item-title">${task.title}</div>
                            <div class="feed-item-meta">
                                <span class="badge info">${projLabel}</span>
                                <span>👤 ${clientInfo}</span>
                                <span>${dateBadge}</span>
                            </div>
                        </div>
                        <div class="feed-item-right">
                            <span class="material-symbols-outlined" style="color:var(--text-muted); font-size: 16px;">edit</span>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add click listeners to items
            reminderList.querySelectorAll('.feed-item').forEach(el => {
                el.addEventListener('click', () => {
                    onOpenTaskModal(el.dataset.taskId);
                });
            });
        }
    }

    // 2. Blockers: tasks with dependency
    const blockedTasks = tasks.filter(t => t.hasDependency);
    const blockersList = document.getElementById('dashboard-blockers-list');
    const blockersBadge = document.getElementById('blocked-tasks-count');

    if (blockersList) {
        if (blockedTasks.length === 0) {
            blockersList.innerHTML = `<div class="empty-state">No active blockers. Flow is smooth!</div>`;
            if (blockersBadge) blockersBadge.className = "badge success";
            if (blockersBadge) blockersBadge.textContent = "0 Blocked";
        } else {
            if (blockersBadge) blockersBadge.className = "badge danger";
            if (blockersBadge) blockersBadge.textContent = `${blockedTasks.length} Blocked`;
            
            blockersList.innerHTML = blockedTasks.map(task => {
                return `
                    <div class="feed-item" data-task-id="${task.id}">
                        <div class="feed-item-left">
                            <div class="feed-item-title">${task.title}</div>
                            <div class="feed-item-meta" style="color: var(--color-danger); font-weight: 500;">
                                ⚠️ Blocked by: ${task.dependencyPerson || 'Someone else'}
                            </div>
                            <div class="feed-item-meta">
                                <span style="display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden; text-overflow:ellipsis;">
                                    Issue: ${task.dependencyIssue || 'Details pending'}
                                </span>
                            </div>
                        </div>
                        <div class="feed-item-right">
                            <span class="material-symbols-outlined" style="color:var(--text-muted); font-size: 16px;">edit</span>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add click listeners
            blockersList.querySelectorAll('.feed-item').forEach(el => {
                el.addEventListener('click', () => {
                    onOpenTaskModal(el.dataset.taskId);
                });
            });
        }
    }
}

function renderFunnelChart() {
    const container = document.getElementById('crm-funnel-chart-container');
    if (!container) return;

    const tasks = store.getAllTasks();
    const crmTasks = tasks.filter(t => {
        const p = store.getProjectById(t.projectType);
        return (p ? p.templateType : t.projectType) === 'nable-attendance';
    });

    let cold = 0, warm = 0, demo = 0, won = 0;
    crmTasks.forEach(t => {
        const status = t.leadStatus || 'Cold';
        if (status.includes('Cold')) cold++;
        else if (status.includes('Warm')) warm++;
        else if (status.includes('Demo') || (t.demoStage && t.demoStage !== 'None')) demo++;
        else if (status.includes('Won') || t.installed === 'Yes') won++;
    });

    // Cumulative calculations
    const countTotal = cold + warm + demo + won;
    const countWarm = warm + demo + won;
    const countDemo = demo + won;
    const countWon = won;

    if (countTotal === 0) {
        container.innerHTML = `<div class="empty-state">No CRM leads found.</div>`;
        return;
    }

    const pctWarm = countTotal > 0 ? Math.round((countWarm / countTotal) * 100) : 0;
    const pctDemo = countTotal > 0 ? Math.round((countDemo / countTotal) * 100) : 0;
    const pctWon = countTotal > 0 ? Math.round((countWon / countTotal) * 100) : 0;

    container.innerHTML = `
        <svg viewBox="0 0 300 180" style="width: 100%; height: 100%;">
            <!-- Stage 1 (Top): Leads -->
            <polygon points="20,10 280,10 250,45 50,45" fill="var(--color-primary)" opacity="0.85"></polygon>
            <text x="150" y="28" text-anchor="middle" fill="var(--text-inverse)" font-size="10" font-weight="700">Leads: ${countTotal} (100%)</text>
            
            <!-- Stage 2: Contacted / Warm -->
            <polygon points="55,50 245,50 215,85 85,85" fill="var(--color-purple)" opacity="0.85"></polygon>
            <text x="150" y="68" text-anchor="middle" fill="var(--text-inverse)" font-size="10" font-weight="700">Warm: ${countWarm} (${pctWarm}%)</text>
            
            <!-- Stage 3: Demo -->
            <polygon points="90,90 210,90 180,125 120,125" fill="var(--color-warning)" opacity="0.85"></polygon>
            <text x="150" y="108" text-anchor="middle" fill="var(--text-inverse)" font-size="10" font-weight="700">Demo: ${countDemo} (${pctDemo}%)</text>
            
            <!-- Stage 4 (Bottom): Won -->
            <polygon points="125,130 175,130 165,165 135,165" fill="var(--color-success)" opacity="0.85"></polygon>
            <text x="150" y="148" text-anchor="middle" fill="var(--text-inverse)" font-size="10" font-weight="700">Won: ${countWon} (${pctWon}%)</text>
        </svg>
    `;
}
