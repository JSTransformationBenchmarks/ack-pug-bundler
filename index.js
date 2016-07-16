const ack = require('ack-node')

var jade = require('jade')
var fs = require('fs')
var isPugFile = require('./watch-filter')
var watch = require('watch')

module.exports.crawlFolders = crawlFolders
module.exports.watchPath = watchPath
module.exports.writeFile = writeFile
module.exports.createMonitor = createMonitor
module.exports.monitorFileDelete = monitorFileDelete

function watchPath(folderPath, outPath, searchOps){
  watch.createMonitor((folderPath||'.'), monitorLoader(outPath, searchOps))
}

function monitorLoader(outPath, searchOps){
  return function(monitor){
    createMonitor(monitor, outPath, searchOps)
  }
}

function monitorFileChange(f, outPath, searchOps) {
  if(isPugFile(f)){
    return writeFile(f, outPath, searchOps)
    .then(function(){
      console.log('\x1b[36m[ack-pug-monitor]:wrote: \x1b[0m'+f)
    })
  }
}

function monitorFileDelete(filePath, outPath) {
  var jadeF = filePath+'.js'

  outPath = ack.path(outPath).join(ack.path(f).getName()).path || f

  if(isPugFile(jadeF)){
    fs.unlink(outPath)
    console.log('\x1b[31m[ack-pug-monitor]\x1b[0m:deleted: '+filePath)
  }
}

function createMonitor(monitor, outPath, searchOps) {
  monitor.on("created", function(f){
    monitorFileChange(f, outPath, searchOps)
  })
  
  monitor.on("changed", function(f){
    monitorFileChange(f, outPath, searchOps)
  })
  
  monitor.on("removed", function(f){
    monitorFileDelete(f, outPath)
  })

  process.on('exit',()=>{
    monitor.stop();// Stop watching
  })
}

/**
  @searchOps {
    outType:'ecma6'||'common'//controls output js file for export versus module.exports
  }
*/
function writeFile(f, outPath, searchOps){
  searchOps = searchOps || {}
  outPath = ack.path(outPath).join(ack.path(f).getName()).path || f

  var html = jade.renderFile(f)
  var target = outPath+'.js'
  html = html.replace(/"/g, '\\\"')//escape(html)
  html = html.replace(/(\n)/g, '"+$1"\\n')//escape linefeeds
  html = html.replace(/(\r)/g, '"+$1"\\r')//escape linereturns
  
  if(searchOps.outType=='common'){
    var output = 'module.exports="'+html+'"'
  }else{
    var output = 'export default "'+html+'"'
  }

  return ack.path(outPath).removeFile().paramDir()
  .callback(function(callback){
    fs.writeFile(target, output, callback)
  })

}



function repeater(f, outPath, searchOps){
  if(f.path.search(/\.(pug|jade)\.js$/)>=0){
    deleteRepeater(f)
    return
  }
  return writeFile(f.path, outPath, searchOps)
}

function outRepeater(outPath, searchOps){
  return function(f){
    return repeater(f, outPath, searchOps)
  }
}

function deleteRepeater(f){
  const F = ack.file(f.path)
  return F.Join().removeExt().exists().if(false,()=>F.delete())
}

/**
  @searchOps {
    outType:'ecma6'||'common'//controls output js file for export versus module.exports
    filter:[
      'folder1/**~/*.pug',//example 1, !You have to replace **~ with **
      'folder2/**~/*.jade'//example 2, !You have to replace **~ with **
    ]
  }
*/
function crawlFolders(path, outPath, searchOps){
  outPath = outPath || path
  const fPath = ack.path(path)
  searchOps = searchOps || {}
  searchOps.filter = searchOps.filter || ['**/**.pug','**/**.jade','**.pug','**.jade']//['**/**.pug','**/**.jade']

  return fPath.recurFilePath(outRepeater(outPath,searchOps), searchOps)
  .catch(e=>console.error(e))
}