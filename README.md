ora.js
====

A JavaScript library to open, view, edit and save OpenRaster images.

Features
---
 * Thumbnail
 * Pre-rendered image is used if present
 * Layers
 * Layer blending modes

Install
---
Just copy ora.js and the included dependencies to your scripts folder. If you want layer blending modes, copy ora-blending.js too.

In your HTML file, include the libraries:

```
    <script type="text/javascript" src="zip.js"></script>
    <script type="text/javascript" src="zip-fs.js"></script>
    <script type="text/javascript" src="ora.js"></script>
    <script type="text/javascript" src="ora-blending.js"></script>

```

Note that you might need extra configuration for zip.js to find its own scripts:

```
    <script type="text/javascript">
        zip.workerScriptsPath = "resources/";
    </script>
```

Usage
---
Pass the .ora file to ora.load(), and use drawThumbnail() or drawComposite() to draw the image into a canvas element.
```
ora.load(fileInput.files[0], function(oraFile) {
    oraFile.drawThumbnail(thumbCanvas);               
    oraFile.drawComposite(imageCanvas);
});
```

Alternatively, you can create a new Ora object and load into that:
```
var oraFile = new ora.Ora();
oraFile.load(fileInput.files[0], function(oraFile) {
    // do things
});
```

Or just create an empty image and make your own layers:
```
var oraFile = new ora.Ora(100, 100);
var layer = oraFile.addLayer('layer', 0);

// load image from any source...
layer.image = new Image();
// ...
layer.composite = 'svg:multiply';
layer.opacity = 0.7;
layer.x = 25;
layer.y = 30;
```

You can access and modify the already existing layers though the layers array.
```
oraFile.layers[3].opacity = 0.1;
oraFile.layers[0].visibility = 'hidden';
```

And when you are done, you can save the image into a Blob using save().
```
oraFile.save(function (blob) {
	// save to disk or send to your server...
});
```

Dependencies
---
The project is using a slightly modified version the [zip.js](http://gildas-lormeau.github.io/zip.js/) library.
