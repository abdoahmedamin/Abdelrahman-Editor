import {
    LineBasicMaterial, WebGLRenderer, Vector3, Color, Scene, PerspectiveCamera,
    OrthographicCamera, GridHelper, AxesHelper, AmbientLight,
    DirectionalLight, Line, BufferGeometry, Raycaster, Vector2,
    BoxGeometry, MeshStandardMaterial, Mesh, TextureLoader, DoubleSide,
    Box2, Box3, Object3D, Plane, DataTexture, RGBAFormat, FloatType,
    RepeatWrapping
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface Wall {
    type: 'wall';
    start: Vector3;
    end: Vector3;
    angle: number;
    length: number;
    id: string;
    selected?: boolean;
    highlighted?: boolean;
}

export class Viewer{
    private container: HTMLElement;
    private renderer: WebGLRenderer;
    private scene2D: Scene;
    private scene3D: Scene;
    private camera2D: OrthographicCamera;
    private camera3D: PerspectiveCamera;
    private controls2D: OrbitControls;
    private controls3D: OrbitControls;
    private is2D: boolean = true;
    private walls: Wall[] = [];
    private wallCounter: number = 0;
    private isDrawing: boolean = false;
    private currentStartPoint: Vector3 | null = null;
    private tempLine: Line | null = null;
    private wallMeshes: Map<string, Object3D> = new Map();
    private raycaster: Raycaster = new Raycaster();
    private mouse: Vector2 = new Vector2();
    private textureLoader: TextureLoader = new TextureLoader();
    private intersectionPlane: Plane;
    private currentTool: 'draw' | 'select' | 'delete' = 'draw';
    private gridVisible: boolean = true;
    private gridHelpers: GridHelper[] = [];
    private currentScene: Scene;
    private currentCamera: PerspectiveCamera | OrthographicCamera;
    private controls: OrbitControls;
    public onWallsUpdate: ((walls: Wall[]) => void) | null = null;

    constructor(container: HTMLElement){
        this.container=container;
        this.intersectionPlane = new Plane(new Vector3(0, 0, 1), 0);
   
        this.renderer=this.createRenderer();
            this.renderer.setSize(container.clientWidth,container.clientHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
        container.append(this.renderer.domElement);
     
        this.scene2D=this.createScene2D();
        this.scene3D=this.createScene3D();
        this.camera2D=this.createCamera2D();
        this.camera3D=this.createCamera3D();
        this.controls2D=this.createControls2D();
        this.controls3D=this.createControls3D();
        this.setup();
        this.animate();

        // Add window resize handler
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Initialize wall details panel
        this.updateWallDetailsPanel();

        this.currentScene = this.scene2D;
        this.currentCamera = this.camera2D;
        this.controls = this.controls2D;
    }

    private setup() {
        // Add event listeners
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        window.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent right-click menu

        // Add grid and lights to both scenes
        this.addGridAndLights(this.scene2D);
        this.addGridAndLights(this.scene3D);
    }

    private createRenderer(): WebGLRenderer {
        var renderer=new WebGLRenderer({antialias:true});
        return renderer;
    }

    private createScene2D(): Scene {
        const scene = new Scene();
        scene.background = new Color('white');
        return scene;
    }

    private createScene3D(): Scene {
        const scene = new Scene();
        scene.background = new Color('white');
        return scene;
    }

    private createCamera2D(): OrthographicCamera {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const frustumSize = 100;
        const camera = new OrthographicCamera(
            -frustumSize * aspect / 2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            -frustumSize / 2,
            1,
            100
        );
        // Position camera to look at XY plane from above
        camera.position.set(0, 0, 5);
        camera.lookAt(0, 0, 0);
        return camera;
    }

    private createCamera3D(): PerspectiveCamera {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const camera = new PerspectiveCamera(35, aspect, 0.1, 500);
        camera.position.set(50, 50, 50);
        camera.lookAt(0, 0, 0);
        return camera;
    }

    private createControls2D(): OrbitControls {
        const controls = new OrbitControls(this.camera2D, this.container);
        controls.enableRotate = false;
        controls.enablePan = true;
        controls.panSpeed = 2;
        controls.zoomSpeed = 1;
        controls.update();
        return controls;
    }

    private createControls3D(): OrbitControls {
        const controls = new OrbitControls(this.camera3D, this.container);
        controls.panSpeed = 2;
        controls.zoomSpeed = 1;
        controls.update();
        return controls;
    }

    private addGridAndLights(scene: Scene) {
        // Add grid with different settings for 2D and 3D
        const is2D = scene === this.scene2D;
        // Make grid more visible with darker colors and more lines
        const grid = new GridHelper(200, 40, 0x999999, 0xcccccc);
        grid.material.opacity = 0.8; // Increase opacity
        grid.material.transparent = true;
        
        if (is2D) {
            // For 2D view, rotate grid to XY plane
            grid.rotation.x = Math.PI / 2;
            grid.position.set(0, 0, 0);
        } else {
            // For 3D view, keep grid in XZ plane (default)
            grid.position.set(0, 0, 0);
        }
        scene.add(grid);
        this.gridHelpers.push(grid);

        // Add axes helper with more visible colors
        const axesHelper = new AxesHelper(is2D ? 50 : 5);
        scene.add(axesHelper);

        // Add lights (only for 3D view)
        if (!is2D) {
            const ambientLight = new AmbientLight('white', 0.8);
            scene.add(ambientLight);

            const directionalLight = new DirectionalLight('white', 0.8);
            directionalLight.position.set(5, 5, 5);
            scene.add(directionalLight);
        }
    }

    public setView(is2D: boolean) {
        this.is2D = is2D;
        this.currentScene = is2D ? this.scene2D : this.scene3D;
        this.currentCamera = is2D ? this.camera2D : this.camera3D;
        this.controls = is2D ? this.controls2D : this.controls3D;
        
        if (is2D) {
            // Reset 2D view position
            this.camera2D.position.set(0, 0, 5);
            this.camera2D.lookAt(0, 0, 0);
            this.controls2D.target.set(0, 0, 0);
            this.controls2D.update();
        } else {
            this.controls3D.update();
            this.update3DView();
        }
        this.render();
    }

    private update3DView() {
        // Clear existing 3D meshes
        this.wallMeshes.forEach(mesh => this.scene3D.remove(mesh));
        this.wallMeshes.clear();
        // Recreate all walls in 3D
        this.walls.forEach(wall => this.createWallMesh3D(wall));
        this.updateWallDetailsPanel();
    }

    private createWallTexture(): DataTexture {
        // Create a procedural brick pattern texture
        const size = 64;
        const data = new Float32Array(size * size * 4);
        
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const index = (i * size + j) * 4;
                
                // Create brick pattern
                const brickWidth = 8;
                const brickHeight = 4;
                const mortarThickness = 1;
                
                const isMortarX = (j % brickWidth) < mortarThickness;
                const isMortarY = (i % brickHeight) < mortarThickness;
                
                if (isMortarX || isMortarY) {
                    // Mortar color (light gray)
                    data[index] = 0.8;     // R
                    data[index + 1] = 0.8; // G
                    data[index + 2] = 0.8; // B
                    data[index + 3] = 1.0; // A
                } else {
                    // Brick color (reddish brown)
                    data[index] = 0.6;     // R
                    data[index + 1] = 0.3; // G
                    data[index + 2] = 0.2; // B
                    data[index + 3] = 1.0; // A
                }
            }
        }
        
        const texture = new DataTexture(data, size, size, RGBAFormat, FloatType);
        texture.wrapS = texture.wrapT = RepeatWrapping;
        texture.needsUpdate = true;
        return texture;
    }

    private createWallMesh3D(wall: Wall) {
        const wallHeight = 3; // meters
        const wallThickness = 0.2; // meters
        const wallLength = wall.length;

        // Create wall geometry
        const geometry = new BoxGeometry(wallLength, wallHeight, wallThickness);

        // Create and apply procedural texture
        const texture = this.createWallTexture();
        texture.repeat.set(wallLength / 2, wallHeight / 2);

        const material = new MeshStandardMaterial({
            map: texture,
            side: DoubleSide,
            roughness: 0.7,
            metalness: 0.1
        });

        const mesh = new Mesh(geometry, material);

        // Position and rotate the wall
        const midPoint = new Vector3().addVectors(wall.start, wall.end).multiplyScalar(0.5);
        mesh.position.set(midPoint.x, wallHeight / 2, midPoint.y);
        mesh.rotation.y = -wall.angle; // Negative for correct orientation

        mesh.userData.wallId = wall.id;
        this.scene3D.add(mesh);
        this.wallMeshes.set(wall.id, mesh);
    }

    public addWall(start: Vector3, end: Vector3): Wall {
        const length = start.distanceTo(end);
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const wall: Wall = {
            type: 'wall',
            start: start.clone(),
            end: end.clone(),
            angle,
            length,
            id: `wall_${this.wallCounter++}`,
            selected: false,
            highlighted: false
        };
        this.walls.push(wall);
        this.createWallMesh2D(wall);
        if (!this.is2D) {
            this.createWallMesh3D(wall);
        }
        this.updateWallList();
        return wall;
    }

    private createWallMesh2D(wall: Wall) {
        // Create a line for the wall (yellow for 2D view)
        const material = new LineBasicMaterial({ 
            color: wall.selected ? 0xff00ff : (wall.highlighted ? 0x00ffff : 0xffd700) // Yellow color
        });
        const points = [wall.start, wall.end];
        const geometry = new BufferGeometry().setFromPoints(points);
        const line = new Line(geometry, material);
        line.userData.wallId = wall.id;

        // Create a rectangle for wall thickness (semi-transparent yellow fill)
        const wallThickness = 0.2;
        const wallLength = wall.length;
        const wallGeometry = new BoxGeometry(wallLength, wallThickness, 0.01);
        const wallMaterial = new MeshStandardMaterial({ 
            color: wall.selected ? 0xff00ff : (wall.highlighted ? 0x00ffff : 0xffd700), // Yellow color
            side: DoubleSide,
            transparent: true,
            opacity: 0.6
        });
        const wallMesh = new Mesh(wallGeometry, wallMaterial);

        // Position and rotate the wall mesh
        const midPoint = new Vector3().addVectors(wall.start, wall.end).multiplyScalar(0.5);
        wallMesh.position.set(midPoint.x, midPoint.y, 0);
        wallMesh.rotation.z = wall.angle;
        wallMesh.userData.wallId = wall.id;

        this.scene2D.add(line);
        this.scene2D.add(wallMesh);
        this.wallMeshes.set(wall.id, wallMesh);
    }

    private onMouseMove(e: MouseEvent) {
        this.updateMousePosition(e);

        if (this.is2D) {
            if (this.isDrawing && this.currentStartPoint) {
                const intersects = this.getIntersectionPoint();
                if (intersects) {
                    this.updateTempLine(this.currentStartPoint, intersects);
                }
            } else {
                // Check for wall highlighting
                const intersects = this.getWallIntersection();
                if (intersects.length > 0) {
                    const wallId = intersects[0].object.userData.wallId;
                    this.highlightWall(wallId);
                } else {
                    this.clearWallStates();
                }
            }
        }
    }

    private onMouseDown(e: MouseEvent) {
        if (this.is2D) {
            if (e.button === 0) { // Left click
                if (this.currentTool === 'draw') {
                    const intersects = this.getIntersectionPoint();
                    if (intersects) {
                        if (!this.isDrawing) {
                            // Start drawing
                            this.isDrawing = true;
                            this.currentStartPoint = intersects;
                            this.tempLine = this.createTempLine(intersects, intersects);
                            this.scene2D.add(this.tempLine);
                        } else {
                            // Finish drawing
                            const wall = this.addWall(this.currentStartPoint!, intersects);
                            this.isDrawing = false;
                            this.scene2D.remove(this.tempLine!);
                            this.tempLine = null;
                            this.currentStartPoint = null;
                        }
                    }
                } else if (this.currentTool === 'select') {
                    const intersects = this.getWallIntersection();
                    if (intersects.length > 0) {
                        const wallId = intersects[0].object.userData.wallId;
                        this.selectWall(wallId);
                    } else {
                        this.clearWallStates();
                    }
                } else if (this.currentTool === 'delete') {
                    const intersects = this.getWallIntersection();
                    if (intersects.length > 0) {
                        const wallId = intersects[0].object.userData.wallId;
                        this.deleteWall(wallId);
                    }
                }
            } else if (e.button === 2) { // Right click
                // Handle wall selection
                const intersects = this.getWallIntersection();
                if (intersects.length > 0) {
                    const wallId = intersects[0].object.userData.wallId;
                    this.selectWall(wallId);
                } else {
                    this.clearWallStates();
                }
            }
        }
    }

    private onMouseUp(e: MouseEvent) {
        // Handle any mouse up events if needed
    }

    private createTempLine(start: Vector3, end: Vector3): Line {
        // Make the temporary drawn line red for visibility
        const material = new LineBasicMaterial({ color: 0xff0000 });
        const points = [start, end];
        const geometry = new BufferGeometry().setFromPoints(points);
        return new Line(geometry, material);
    }

    private updateTempLine(start: Vector3, end: Vector3) {
        if (this.tempLine) {
            const positions = this.tempLine.geometry.attributes.position;
            positions.setXYZ(0, start.x, start.y, start.z);
            positions.setXYZ(1, end.x, end.y, end.z);
            positions.needsUpdate = true;
        }
    }

    private updateMousePosition(e: MouseEvent) {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / this.container.clientWidth) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / this.container.clientHeight) * 2 + 1;
    }

    private getIntersectionPoint(): Vector3 | null {
        this.raycaster.setFromCamera(this.mouse, this.is2D ? this.camera2D : this.camera3D);
        const intersects = this.raycaster.ray.intersectPlane(this.intersectionPlane, new Vector3());
        return intersects || null;
    }

    private getWallIntersection(): any[] {
        this.raycaster.setFromCamera(this.mouse, this.is2D ? this.camera2D : this.camera3D);
        const wallObjects = Array.from(this.wallMeshes.values());
        return this.raycaster.intersectObjects(wallObjects);
    }

    private animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.render();
    }

    private render() {
        if (this.is2D) {
            this.controls2D.update();
            this.renderer.render(this.scene2D, this.camera2D);
        } else {
            this.controls3D.update();
            this.renderer.render(this.scene3D, this.camera3D);
        }
    }

    private onWindowResize() {
        // Update renderer size
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Update 2D camera
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const frustumSize = 100;
        this.camera2D.left = -frustumSize * aspect / 2;
        this.camera2D.right = frustumSize * aspect / 2;
        this.camera2D.top = frustumSize / 2;
        this.camera2D.bottom = -frustumSize / 2;
        this.camera2D.updateProjectionMatrix();

        // Update 3D camera
        this.camera3D.aspect = aspect;
        this.camera3D.updateProjectionMatrix();
    }

    private addDimensionLabel(wall: Wall) {
        // Removed: No label will be shown on the wall
    }

    private highlightWall(id: string) {
        this.walls.forEach(wall => {
            wall.highlighted = wall.id === id;
            this.updateWallAppearance(wall);
        });
        this.updateWallDetailsPanel();
    }

    private selectWall(id: string) {
        this.walls.forEach(wall => {
            wall.selected = wall.id === id;
            this.updateWallAppearance(wall);
        });
        this.updateWallList();
        this.render();
    }

    private clearWallStates() {
        this.walls.forEach(wall => {
            wall.selected = false;
            wall.highlighted = false;
            this.updateWallAppearance(wall);
        });
        this.updateWallDetailsPanel();
    }

    private updateWallAppearance(wall: Wall) {
        const mesh = this.wallMeshes.get(wall.id);
        if (mesh) {
            if (mesh instanceof Mesh) {
                const material = mesh.material as MeshStandardMaterial;
                material.color.setHex(wall.selected ? 0x2196F3 : (wall.highlighted ? 0x90CAF9 : 0x757575));
            }
        }
    }

    // Add this method to update wall details UI
    private updateWallDetailsPanel() {
        const detailsDiv = document.getElementById('wall-details');
        if (!detailsDiv) return;
        const totalWalls = this.walls.length;
        const totalLength = this.walls.reduce((sum, wall) => sum + wall.length, 0);
        let html = `<b>Walls Summary</b><br>`;
        html += `Total Walls: <b>${totalWalls}</b><br>`;
        html += `Total Length: <b>${totalLength.toFixed(2)} m</b><br>`;
        detailsDiv.innerHTML = html;
    }

    public setTool(tool: 'draw' | 'select' | 'delete') {
        this.currentTool = tool;
        this.isDrawing = false;
        if (this.tempLine) {
            this.scene2D.remove(this.tempLine);
            this.tempLine = null;
        }
        this.currentStartPoint = null;
    }

    public resetView() {
        if (this.is2D) {
            this.camera2D.position.set(0, 0, 10);
            this.camera2D.lookAt(0, 0, 0);
            this.controls2D.target.set(0, 0, 0);
            this.controls2D.update();
        } else {
            this.camera3D.position.set(5, 5, 5);
            this.camera3D.lookAt(0, 0, 0);
            this.controls3D.target.set(0, 0, 0);
            this.controls3D.update();
        }
        this.render();
    }

    public toggleGrid() {
        this.gridVisible = !this.gridVisible;
        this.gridHelpers.forEach(grid => {
            grid.visible = this.gridVisible;
        });
        this.render();
    }

    public zoomToFit() {
        if (this.is2D) {
            this.zoomToFit2D();
        } else {
            this.zoomToFit3D();
        }
    }

    private zoomToFit2D() {
        if (this.walls.length === 0) {
            // If no walls, reset to default view
            this.camera2D.position.set(0, 0, 5);
            this.camera2D.lookAt(0, 0, 0);
            this.controls2D.target.set(0, 0, 0);
            this.controls2D.update();
            return;
        }

        // Calculate bounding box of all walls
        const box = new Box2();
        this.walls.forEach(wall => {
            box.expandByPoint(new Vector2(wall.start.x, wall.start.y));
            box.expandByPoint(new Vector2(wall.end.x, wall.end.y));
        });

        // Add some padding
        const padding = 5;
        const size = box.getSize(new Vector2());
        const center = box.getCenter(new Vector2());
        
        // Calculate the required camera distance
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const maxDim = Math.max(size.x, size.y / aspect);
        const cameraZ = maxDim / 2 + padding;

        // Update camera position and target
        this.camera2D.position.set(center.x, center.y, cameraZ);
        this.camera2D.lookAt(center.x, center.y, 0);
        this.controls2D.target.set(center.x, center.y, 0);
        this.controls2D.update();
    }

    private zoomToFit3D() {
        if (this.walls.length === 0) {
            // If no walls, reset to default view
            this.camera3D.position.set(50, 50, 50);
            this.camera3D.lookAt(0, 0, 0);
            this.controls3D.target.set(0, 0, 0);
            this.controls3D.update();
            return;
        }

        // Calculate bounding box of all walls
        const box = new Box3();
        this.walls.forEach(wall => {
            box.expandByPoint(wall.start);
            box.expandByPoint(wall.end);
            // Add height to the box
            box.expandByPoint(new Vector3(wall.start.x, 3, wall.start.y));
            box.expandByPoint(new Vector3(wall.end.x, 3, wall.end.y));
        });

        // Add some padding
        const padding = 5;
        const size = box.getSize(new Vector3());
        const center = box.getCenter(new Vector3());
        
        // Calculate the required camera distance
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera3D.fov * (Math.PI / 180);
        const cameraDistance = maxDim / (2 * Math.tan(fov / 2)) + padding;

        // Position camera at an angle
        const angle = Math.PI / 4; // 45 degrees
        this.camera3D.position.set(
            center.x + cameraDistance * Math.cos(angle),
            center.y + cameraDistance * Math.sin(angle),
            center.z + cameraDistance * Math.sin(angle)
        );
        
        this.camera3D.lookAt(center);
        this.controls3D.target.copy(center);
        this.controls3D.update();
    }

    private deleteWall(wallId: string) {
        const wall = this.walls.find(w => w.id === wallId);
        if (wall) {
            // Remove wall meshes from scenes
            const mesh = this.wallMeshes.get(wallId);
            if (mesh) {
                this.scene2D.remove(mesh);
                if (!this.is2D) {
                    this.scene3D.remove(mesh);
                }
                this.wallMeshes.delete(wallId);
            }
            // Remove wall from array
            this.walls = this.walls.filter(w => w.id !== wallId);
            this.updateWallList();
            this.render();
        }
    }

    private updateWallList() {
        if (this.onWallsUpdate) {
            this.onWallsUpdate(this.walls);
        }
    }
}