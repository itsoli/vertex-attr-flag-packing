// create canvas

const canvas = document.getElementById('deine-mudder')! as HTMLCanvasElement;
const gl = canvas.getContext('webgl')!;

// create geometry

function packFlagsUint8(...flags: number[]): number {
    let packed = 0;
    let shift = 7;
    for (let i = 0, n = Math.min(flags.length, 8); i < n; ++i) {
        packed |= Number(flags[i]) << shift;
        --shift;
    }
    return packed & 0xff;
}

function generatePermutations(dim: number): number[][] {
    const out: number[][] = [];
    for (let i = 0; i < 2**dim; i++) {
        const p = [];
        for (let n = i; n !== 0; n >>= 1) {
            p.push(n & 1);
        }
        while (p.length < dim) {
            p.push(0);
        }
        out.push(p);
    }
    return out;
}

function quad(x = 0, y = 0, size = 1) {
    const s = size * 0.5;
    return [
        x - s, y + s, 0.0,
        x - s, y - s, 0.0,
        x + s, y - s, 0.0,
        x + s, y - s, 0.0,
        x + s, y + s, 0.0,
        x - s, y + s, 0.0,
    ];
}

function generateTestData(
    count: number,
    size: number = 2.0,
    padding: number = 0.05
): [positions: number[], flags: number[], indices: number[]] {
    const outPositions: number[] = [];
    const outFlags: number[] = [];

    const permutations = generatePermutations(count);
    const s: string[] = [];

    for (const [index, flags] of permutations.entries()) {
        const row = count - 1 - Math.floor(index / count);
        const col = index % count;
        const quadSize = (size - (count + 1) * padding) / count;
        const x = padding * (col + 1) + col * quadSize + 0.5 * quadSize - 0.5 * size;
        const y = padding * (row + 1) + row * quadSize + 0.5 * quadSize - 0.5 * size;
        outPositions.push(...quad(x, y, quadSize));

        const packed0 = packFlagsUint8(...flags, 0);
        const packed1 = packFlagsUint8(...flags, 1);
        // outFlags.push(packed0, packed1, packed0, packed0, packed1, packed0);
        // outFlags.push(packed1, packed0, packed1, packed1, packed0, packed1);
        // outFlags.push(packed0, packed1, packed1, packed1, packed0, packed0);
        outFlags.push(packed1, packed0, packed0, packed0, packed1, packed1);

        s.push(flags.join(' '));
        if ((index + 1) % count === 0) {
            console.log(s.join(' | '));
            s.length = 0;
        }
    }

    if (s.length !== 0) {
        console.log(s.join(' | '));
    }

    const outIndices = outFlags.map((_, i) => i);

    return [outPositions, outFlags, outIndices];
}

const [positions, flags, indices] = generateTestData(3);

const positionsBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionsBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
gl.bindBuffer(gl.ARRAY_BUFFER, null);

const flagsBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, flagsBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(flags), gl.STATIC_DRAW);
gl.bindBuffer(gl.ARRAY_BUFFER, null);

const indexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

// shaders

const vertCode = `\
precision highp float;

attribute vec3 coordinates;
attribute float flags;

varying float vFlags;

void main(void) {
    vFlags = flags;
    gl_Position = vec4(coordinates, 1.0);
}
`;

const vertShader = gl.createShader(gl.VERTEX_SHADER)!;
gl.shaderSource(vertShader, vertCode);
gl.compileShader(vertShader);
const vertCompilationLog = gl.getShaderInfoLog(vertShader);
if (vertCompilationLog) {
    console.log(`Vertex shader compiler log:\n${vertCompilationLog}`);
}

const fragCode = `\
precision highp float;

varying float vFlags;

void unpackFlags3alpha(float encoded, out float a, out float b, out float c, out float d) {
    a = floor(encoded * 2.0);
    b = floor(encoded * 4.0) - a * 2.0;
    c = floor(encoded * 8.0) - a * 4.0 - b * 2.0;
    d = encoded * 16.0 - a * 8.0 - b * 4.0 - c * 2.0;
}

void main() {
    float a, b, c, alpha;
    unpackFlags3alpha(vFlags, a, b, c, alpha);
    gl_FragColor = vec4(a, b, c, alpha);
    // gl_FragColor = vec4(vec3(a, b, c) * alpha, 1.0);
}
`;

const fragShader = gl.createShader(gl.FRAGMENT_SHADER)!;
gl.shaderSource(fragShader, fragCode);
gl.compileShader(fragShader);
const fragCompilationLog = gl.getShaderInfoLog(fragShader);
if (fragCompilationLog) {
    console.log(`Fragment shader compiler log:\n${fragCompilationLog}`);
}

const shaderProgram = gl.createProgram()!;
gl.attachShader(shaderProgram, vertShader);
gl.attachShader(shaderProgram, fragShader);
gl.linkProgram(shaderProgram);
gl.useProgram(shaderProgram);

// buffer bindings

gl.bindBuffer(gl.ARRAY_BUFFER, positionsBuffer);
const coord = gl.getAttribLocation(shaderProgram, "coordinates");
gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(coord);

gl.bindBuffer(gl.ARRAY_BUFFER, flagsBuffer);
const flagsLocation = gl.getAttribLocation(shaderProgram, "flags");
gl.vertexAttribPointer(flagsLocation, 1, gl.UNSIGNED_BYTE, true, 0, 0);
gl.enableVertexAttribArray(flagsLocation);

gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

// rendering

gl.clearColor(0.9, 0.9, 0.9, 1.0);
gl.enable(gl.DEPTH_TEST);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.viewport(0, 0, canvas.width, canvas.height);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

export {};
