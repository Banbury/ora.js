(function (obj) {
    'use strict';

    // Extract an image from the ora into an Image object
    function extractImage(path, zipfs, ondone, onerror) {
        var imgEntry = zipfs.find(path);
        if (imgEntry) {
            imgEntry.getData64URI('image/png', function (uri) {
                var imageObj = new Image();
                imageObj.onload = ondone;
                imageObj.src = uri;
            });
        } else if (onerror) {
            onerror();
        }
    }

    // Layer object constructor.
    function Layer(width, height, name) {
        this.name = name;
        this.width = width || 0;
        this.height = height || 0;
        this.x = 0;
        this.y = 0;
        this.composite = 'svg:src-over';
        this.opacity = 1;
        this.visibility = 'visible';
    }

    // Get the raw pixel data array for the layer
    Layer.prototype.getImageData = function (width, height) {
        var tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = width;
        tmpCanvas.height = height;
        var tmpCtx = tmpCanvas.getContext('2d');
        tmpCtx.drawImage(this.image, this.x, this.y);
        return tmpCtx.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height).data;
    };

    // OraFile constructor
    function OraFile(width, height) {
        this.width = width || 0;
        this.height = height || 0;
        this.layers = [];
    }

    // Load the file contents from a blob
    // Based on the draft specification from May 2013
    // http://www.freedesktop.org/wiki/Specifications/OpenRaster/Draft/
    OraFile.prototype.load = function (blob, onload) {
        var fs = new zip.fs.FS();
        var that = this;

        function loadLayers(image, ondone) {
            var layersLoaded = 0,
               layerElems = image.getElementsByTagName('stack')[0].getElementsByTagName('layer');

            var layerCount = layerElems.length;
            that.layers = [];

            var onExtract = function(layer) {
                return function() {
                    layer.image = this;
                    layer.width = this.width;
                    layer.height = this.height;

                    layersLoaded++;
                    if (layersLoaded === layerCount) {
                        ondone();
                    }
                };
            };

            for (var i = layerCount - 1; i >= 0; i--) {
                var layer = new Layer();
                var layerElement = layerElems[i];

                layer.name = layerElement.getAttribute('name');
                layer.x = layerElement.getAttribute('x') || 0;
                layer.y = layerElement.getAttribute('y') || 0;
                layer.composite = layerElement.getAttribute('composite-op') || 'svg:src-over';
                layer.opacity = layerElement.getAttribute('opacity') || 1;
                layer.visibility = layerElement.getAttribute('visibility') || 'visible';

                extractImage(layerElement.getAttribute('src'), fs, onExtract(layer));

                that.layers.push(layer);
            }
        }

        function loadStack(ondone) {
            var stackFile = fs.find('stack.xml');
            stackFile.getText(function (text) {
                var xml;
                // http://stackoverflow.com/questions/649614/xml-parsing-of-a-variable-string-in-javascript
                var parseXml;

                if (window.DOMParser) {
                    xml = ( new window.DOMParser() ).parseFromString(text, "text/xml");
                } else {
                    xml = new window.ActiveXObject("Microsoft.XMLDOM");
                    xml.async = false;
                    xml.loadXML(text);
                }
                
                var img = xml.getElementsByTagName('image')[0];
                that.width = img.getAttribute('w');
                that.height = img.getAttribute('h');

                loadLayers(img, ondone);
            });
        }

        function loadOra() {
            // keeping track of finished loading tasks
            var stepsDone = 0, steps = 3;
            var onDone = function () {
                stepsDone++;
                if (stepsDone === steps) {
                    onload();
                }
            };

            extractImage('Thumbnails/thumbnail.png', fs, function() {
                that.thumbnail = this;
                onDone();
            }, onDone);

            extractImage('mergedimage.png', fs, function() {
                that.prerendered = this;
                onDone();
            }, onDone);

            loadStack(onDone);
        }

        fs.importBlob(blob, loadOra);
    };

    // Draw the thumbnail into a canvas element
    OraFile.prototype.drawThumbnail = function (canvas) {
        if (this.thumbnail) {
            canvas.width = this.thumbnail.width;
            canvas.height = this.thumbnail.height;
            var context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(this.thumbnail, 0, 0);
        }
    };

    // Draw the full size composite image from the layer data.
    // Uses the prerendered image if present and enabled
    OraFile.prototype.drawComposite = function (canvas) {
        canvas.width = this.width;
        canvas.height = this.height;
        var layerCount = this.layers.length,
            context = canvas.getContext('2d'),
            layerIdx = 0,
            layer, imgData;

        context.clearRect(0, 0, canvas.width, canvas.height);

        if(obj.ora.enablePrerendered && this.prerendered) {
            context.drawImage(this.prerendered, 0, 0);
            return;
        }

        if (obj.ora.blending) {
            imgData = context.getImageData(0, 0, this.width, this.height);

            while (layerCount > layerIdx) {
                layer = this.layers[layerIdx ];

                if (layer && layer.image && (layer.visibility === 'visible' || layer.visibility === undefined)) {
                    var filter = obj.ora.blending[layer.composite] || obj.ora.blending.normal;
                    var src = layer.getImageData(this.width, this.height);
                    obj.ora.blending.blend(src, imgData.data, layer.opacity, filter);
                }

                layerIdx++;
            }

            context.putImageData(imgData, 0, 0);
        } else {
            while (layerCount > layerIdx) {
                layer = this.layers[layerIdx];
                if (layer && layer.image && (layer.visibility === 'visible' || layer.visibility === undefined)) {
                    if (layer.opacity === undefined) {
                        context.globalAlpha = 1;
                    } else {
                        context.globalAlpha = layer.opacity;
                    }

                    context.drawImage(layer.image, layer.x, layer.y);
                }

                layerIdx++;
            }
        }
    };

    // Add a new layer to the image
    // index can optionally specify the position for the new layer
    OraFile.prototype.addLayer = function (name, index) {
        var layer = new Layer(this.width, this.height, name);
        if(index !== undefined && index < this.layers.length && index >= 0) {
            this.layers.splice(index, 0, layer);
        } else {
            this.layers.push(layer);
        }
        return layer;
    };

    // Create and populate an OraFile object from a blob
    // onload - callback with the loaded object as parameter
    function loadFile(blob, onload) {
        var oraFile = new OraFile();
        oraFile.load(blob, function() {
            onload(oraFile);
        });
    }

    obj.ora = {
        Ora : OraFile,
        OraLayer : Layer,
        load: loadFile,

        // enable use of prerendered image instead of layers (if present)
        enablePrerendered : true
    };
})(this);