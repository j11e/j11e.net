(function () { 
    console.log("creating game");

    // thanks to https://stackoverflow.com/questions/5448545/how-to-retrieve-get-parameters-from-javascript/21210643#21210643
    var findGetParameter = function(parameterName) {
        var result = null,
            tmp = [];
        location.search
            .substr(1)
            .split("&")
            .forEach(function (item) {
              tmp = item.split("=");
              if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
            });
        return result;
    }

    // rather than giving a GRID_WIDTH x GRID_HEIGHT grid as SEED, let's just
    // give the coords of the cells that start as alive. This is a dict whose
    // format is { row_number: [ index, of, alive, cells ], ... }
    var ALIVE_SEED = null;

    var Gol = {
        // a 2D array whose elems are cell states: 0 = dead, 1 = alive
        _grid: [],

        // reference to the DOM element where the game is displayed
        _canvas: null,

        // reference to the generation counter display DOM element
        _counterElem: null,

        // count ticks since last reset
        _counter: null,

        // interval reference from setInterval
        _tickInterval: null,

        // all config params.
        // overwritten by refreshConfig() below 
        config: {
            CELL_WIDTH: 10,
            GRID_WIDTH: 100,
            GRID_HEIGHT: 50,
            TIME_INTERVAL: 100, // milliseconds
            ALIVE_SEED: null,
            SEED: null  // not used now but who knows
        },

        // a few notable patterns...
        presets: {
            glider: {
                1: [2],
                2: [3],
                3: [1,2,3]
            },
        
            glidergun: {
                1: [25],
                2: [23, 25],
                3: [13, 14, 21, 22, 35, 36],
                4: [12, 16, 21, 22, 35, 36],
                5: [1, 2, 11, 17, 21, 22],
                6: [1, 2, 11, 15, 17, 18, 23, 25],
                7: [11, 17, 25],
                8: [12, 16],
                9: [13, 14]
            },
        
            lwss: {
                1: [1, 4],
                2: [5],
                3: [1, 5],
                4: [2, 3, 4, 5]
            },

            pulsar: {
                2: [4, 5, 6, 10, 11, 12],
                4: [2, 7, 9, 14],
                5: [2, 7, 9, 14],
                6: [2, 7, 9, 14],
                7: [4, 5, 6, 10, 11, 12],
                9: [4, 5, 6, 10, 11, 12],
                10: [2, 7, 9, 14],
                11: [2, 7, 9, 14],
                12: [2, 7, 9, 14],
                14: [4, 5, 6, 10, 11, 12]
            }
        },

        // returns an empty grid of GRID_HEIGHT x GRID_WIDTH cells
        _getEmptyGrid: function() {
            var grid = [];
            
            for (var i = 0; i < this.config.GRID_HEIGHT; i++) {
                grid.push(Array(this.config.GRID_WIDTH).fill(0));
            }

            return grid;
        },

        // returns how many living neighbors the cell this._grid[i][j] has
        _countNeighbors: function(i, j) {
            var neighbors = 0;

            // to represent the grid around the target T (T = this._grid[i][j])
            // ---------> j
            // | a b c
            // | d T e
            // | f g h
            // |
            // v i

            if (i > this.config.GRID_HEIGHT || j > this.config.GRID_WIDTH) {
                return 0;
            }

            if (i > 0) {
                // a alive?
                if (j > 0) {
                    if (this._grid[i-1][j-1] == 1) {
                        neighbors++;
                    }
                }
                
                // b alive?
                if (this._grid[i-1][j] == 1) {
                    neighbors++;
                }

                // c alive?
                if (j < this.config.GRID_WIDTH - 2) {
                    if (this._grid[i-1][j+1] == 1) {
                        neighbors++;
                    }
                }
            }
            
            
            // d alive?
            if (j > 0) {    
                if (this._grid[i][j-1] == 1) {
                    neighbors++;
                }
            }

            // e alive?
            if (j < this.config.GRID_WIDTH - 2) {
                if (this._grid[i][j+1] == 1) {
                    neighbors++;
                }
            }

            if (i < this.config.GRID_HEIGHT -2) {
                // f alive?
                if (j > 0) {
                    if (this._grid[i+1][j-1] == 1) {
                        neighbors++;
                    }
                }

                // g alive?
                if (this._grid[i+1][j] == 1) {
                    neighbors++;
                }

                // h alive?
                if (j < this.config.GRID_WIDTH - 2) {
                    if (this._grid[i+1][j+1] == 1) {
                        neighbors++;
                    }
                }
            }

            return neighbors;
        },


        // self-explanatory
        init: function() {
            console.log("initing game");

            document.getElementById("refreshConfig").removeEventListener("click", this.start);
            document.getElementById("refreshConfig").addEventListener("click", this.start);

            document.getElementById("pause").removeEventListener("click", this.pause);
            document.getElementById("pause").addEventListener("click", this.pause);

            document.getElementById("resume").removeEventListener("click", this.resume);
            document.getElementById("resume").addEventListener("click", this.resume);

            document.getElementById("save").removeEventListener("click", this.save);
            document.getElementById("save").addEventListener("click", this.save);

            document.getElementById("restore").removeEventListener("click", this.restore);
            document.getElementById("restore").addEventListener("click", this.restore);

            document.getElementById("import").removeEventListener("click", this.import);
            document.getElementById("import").addEventListener("click", this.import);

            document.getElementById("export").removeEventListener("click", this.export);
            document.getElementById("export").addEventListener("click", this.export);

            // step 0: read config 
            this.refreshConfig();
            this._counter = 0;
            this._counterElem = document.getElementById("counter");

            // step 1: initialize the grid state from SEED (if given), or
            // create an empty one
            if (this.config.SEED) {
                this._grid = this.config.SEED;
            } else {
                this._grid = this._getEmptyGrid();

            }

            // step 2: initialize the grid state from ALIVE_SEED, if given
            if (this.config.ALIVE_SEED) {
                for (row in this.config.ALIVE_SEED) {
                    if (this.config.ALIVE_SEED.hasOwnProperty(row)) {
                        for (var i = 0; i < this.config.ALIVE_SEED[row].length; i++) {
                            this._grid[row][this.config.ALIVE_SEED[row][i]] = 1;
                        }
                    }
                }
            }

            // step 3: initialize the HTML canvas grid
            this._canvas = document.getElementById("canvas");
            
            while (this._canvas.firstChild) {
                this._canvas.removeChild(this._canvas.firstChild);
            }

            canvas.style.width = this.config.GRID_WIDTH * this.config.CELL_WIDTH;
            canvas.style.height = this.config.GRID_HEIGHT * this.config.CELL_WIDTH;

            for (var i = 0; i < this.config.GRID_HEIGHT; i++) {
                for (var j = 0; j < this.config.GRID_WIDTH; j++) {
                    var cell = document.createElement("span");
                    cell.className = "dead";
                    cell.style.width = this.config.CELL_WIDTH;
                    cell.style.height = this.config.CELL_WIDTH;
                    cell.style.display = "inline-block";
                    
                    cell.addEventListener("click", this._getToggleEventHandler(i,j));
                    
                    this._canvas.appendChild(cell);
                }
            }

            console.log("done initing game");
        },

        // returns a toggle event handler function for the cell (i, j)
        // makes the clicked cell go from alive to dead or vice-versa
        _getToggleEventHandler: function(i,j) {
            var self = this;
            return function() {
                self._grid[i][j] = (self._grid[i][j] + 1) % 2;

                this.className = (this.className == "dead") ? "alive" : "dead";
            };
        },

        // start the game!
        start: function() {
            console.log("Starting game...");
            this.pause();

            this.init();

            this.paint();

            this.resume();
        },

        // self-explanatory
        pause: function() {
            clearInterval(this._tickInterval);
        },

        // self-explanatory
        resume: function() {
            this.pause(); // prevent multiple intervals
            this._tickInterval = setInterval(this.tick, this.config.TIME_INTERVAL);
        },

        // update all cells' DOM node classes to reflect the current state
        paint() {
            for (var i = 0; i < this.config.GRID_HEIGHT; i++) {
                for (var j = 0; j < this.config.GRID_WIDTH; j++) {
                    var child = this._canvas.childNodes[i * this.config.GRID_WIDTH + j];
                    child.className = this._grid[i][j] ? "alive" : "dead";
                }
            }
        },

        // save the current state, to be restorable by restore()
        save: function() {
            this._save = this._grid.slice();
        },

        // restore the saved state, or an empty grid if no saved state
        restore: function() {
            this._grid = this._save || this._getEmptyGrid();
            this.paint();
        },

        import: function() {
            this._grid = JSON.parse(document.getElementById('seed').value);
            this.paint();
        },

        export: function() {
            document.getElementById('seed').value = JSON.stringify(this._grid);
        },

        // compute the next state from the current one, then paint()
        tick: function() {
            var newGrid = this._getEmptyGrid();

            for (var i = 0; i < this.config.GRID_HEIGHT; i++) {
                for (var j = 0; j < this.config.GRID_WIDTH; j++) {
                    var cell = this._grid[i][j];
                    var neighborCount = this._countNeighbors(i, j);

                    if (cell == 0) {
                        if (neighborCount == 3) {
                            newGrid[i][j] = 1;
                        }
                    } else {
                        if (neighborCount == 2 || neighborCount == 3) {
                            newGrid[i][j] = 1;
                        }
                    }
                }
            }

            this._grid = newGrid;
            this._counter++;
            this._counterElem.innerText = this._counter;

            this.paint();
        },

        // self-explanatory
        refreshConfig: function() {
            switch (document.forms["params"].preset.value) {
                case "pulsar":
                    this.config.ALIVE_SEED = this.presets.pulsar;
                    break;
                case "glider":
                    this.config.ALIVE_SEED = this.presets.glider;
                    break;
                case "glidergun":
                    this.config.ALIVE_SEED = this.presets.glidergun;
                    break;
                case "lwss":
                    this.config.ALIVE_SEED = this.presets.lwss;
                    break;
                default:
                    this.config.ALIVE_SEED = null;
                    break;
            }
            
            this.config.GRID_WIDTH = parseInt(document.forms["params"].grid_w.value);
            this.config.GRID_HEIGHT = parseInt(document.forms["params"].grid_h.value);
            this.config.TIME_INTERVAL = parseInt(document.forms["params"].tick_delay.value);
        }
    };


    Gol.start = Gol.start.bind(Gol);
    Gol.pause = Gol.pause.bind(Gol);
    Gol.resume = Gol.resume.bind(Gol);
    Gol.tick = Gol.tick.bind(Gol);
    Gol.save = Gol.save.bind(Gol);
    Gol.restore = Gol.restore.bind(Gol);
    Gol.import = Gol.import.bind(Gol);
    Gol.export = Gol.export.bind(Gol);

    window.onload = Gol.start;

    console.log("Game created");
})();