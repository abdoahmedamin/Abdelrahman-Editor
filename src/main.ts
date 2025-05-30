import { Viewer } from './Viewer';

// Get the container element
const container = document.getElementById('viewer-container');
if (!container) {
    throw new Error('Container element not found');
}

// Create the viewer
const viewer = new Viewer(container);

// Get all buttons
const switchTo2DButton = document.getElementById('switch-to-2d');
const switchTo3DButton = document.getElementById('switch-to-3d');
const zoomFitButton = document.getElementById('zoom-fit');
const resetViewButton = document.getElementById('reset-view');
const toggleGridButton = document.getElementById('toggle-grid');
const drawWallButton = document.getElementById('draw-wall');
const wallListContainer = document.getElementById('wall-list-container');

// Function to update wall list
function updateWallList(walls: any[]) {
    if (!wallListContainer) return;
    
    wallListContainer.innerHTML = '';
    walls.forEach((wall, index) => {
        const wallItem = document.createElement('div');
        wallItem.className = `wall-item ${wall.selected ? 'selected' : ''}`;
        wallItem.innerHTML = `
            <span>Wall ${index + 1}</span>
            <span class="wall-length">${wall.length.toFixed(2)}m</span>
        `;
        wallItem.addEventListener('click', () => {
            viewer.selectWall(wall.id);
            updateWallList(walls);
        });
        wallListContainer.appendChild(wallItem);
    });
}

// Add event listeners for view switching
if (switchTo2DButton) {
    switchTo2DButton.addEventListener('click', () => {
        viewer.setView(true);
        switchTo2DButton.classList.add('active');
        switchTo3DButton?.classList.remove('active');
    });
}

if (switchTo3DButton) {
    switchTo3DButton.addEventListener('click', () => {
        viewer.setView(false);
        switchTo3DButton.classList.add('active');
        switchTo2DButton?.classList.remove('active');
    });
}

// Add event listener for zoom to fit
if (zoomFitButton) {
    zoomFitButton.addEventListener('click', () => {
        viewer.zoomToFit();
    });
}

// Add event listener for reset view
if (resetViewButton) {
    resetViewButton.addEventListener('click', () => {
        viewer.resetView();
    });
}

// Add event listener for toggle grid
if (toggleGridButton) {
    toggleGridButton.addEventListener('click', () => {
        viewer.toggleGrid();
        toggleGridButton.classList.toggle('active');
    });
}

// Add event listener for draw wall
if (drawWallButton) {
    drawWallButton.addEventListener('click', () => {
        viewer.setTool('draw');
        drawWallButton.classList.add('active');
    });
}

// Subscribe to wall updates
viewer.onWallsUpdate = (walls) => {
    updateWallList(walls);
};

// Initialize with 2D view and draw tool active
if (switchTo2DButton) switchTo2DButton.classList.add('active');
if (drawWallButton) drawWallButton.classList.add('active');
viewer.setTool('draw'); // Set initial tool to draw