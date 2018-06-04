BigStats.prototype.getStats = function () {

    var that = this;
  
    var getResourceList = (() => {
      return new Promise((resolve,reject) => {
  
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getResourceList() with config: ' +JSON.stringify(this.config)); }
  
        var path = '/mgmt/tm/ltm/virtual/';
        var query = '$select=subPath,fullPath,selfLink,pool';
        
        var uri = that.restHelper.makeRestnodedUri(path, query);
        var restOp = that.createRestOperation(uri);
      
        that.restRequestSender.sendGet(restOp)
        .then((resp) => {
          if (DEBUG === true) {
            logger.info('[BigStats - DEBUG] - getResourceList - resp.statusCode: ' +JSON.stringify(resp.statusCode));
            logger.info('[BigStats - DEBUG] - getResourceList - resp.body: ' +JSON.stringify(resp.body, '', '\t'));
          }
  
          resolve(resp.body);
    
        })
        .catch((error) => {
          logger.info('[BigStats] - Error: ' +JSON.stringify(error));
          reject(error);
        });
    
      });
    }); 
  
    var parseResources = ((list) => {
      return new Promise((resolve,reject) => {
  
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN parseResources() with list: ' +JSON.stringify(list)); }
  
        list.items.map((element, index) => {
  
          Promise.all([getVipStats(element), getPoolStats(element)])
          .then((values) => {
            if (DEBUG === true) { 
              logger.info('[BigStats - DEBUG] - Index:' +index+ ', values[0]: ' +JSON.stringify(values[0],'','\t'));
              logger.info('[BigStats - DEBUG] - Index:' +index+ ', values[1]: ' +JSON.stringify(values[1],'','\t'));
            }
  
            if (typeof that.stats[element.subPath] === 'undefined') {
              that.stats[element.subPath] = {};
            }
            that.stats[element.subPath].vip = values[0];
            that.stats[element.subPath].pool = values[1];
  
            if (DEBUG === true) { logger.info('[BigStats - DEBUG] - list.items.length - 1: ' +(list.items.length - 1)+ '  index: ' +index); }
            if (index === (list.items.length - 1)) {
              if (DEBUG === true) { logger.info('[BigStats - DEBUG] - End of resource list (index === (list.items.length - 1))'); }
              resolve(that.stats);
            }
          });
        });
      });
    });
    
    var getVipStats = ((resource) => {
      return new Promise((resolve,reject) => {
  
        var that = this;
      
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getVipStats with resource_list: ' +JSON.stringify(resource)); }
  
        var path = ""; 
        var PREFIX = "https://localhost";
        if (resource.selfLink.indexOf(PREFIX) === 0) {
          path = resource.selfLink.slice(PREFIX.length).split("?").shift();
        }
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Sliced Path: '+path); }
        var uri = path+'/stats';
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Stats URI: '+uri); }
  
        var url = that.restHelper.makeRestnodedUri(uri);
        var restOp = that.createRestOperation(url);
      
        that.restRequestSender.sendGet(restOp)
        .then((resp) => {
  
          let name = path.split("/").slice(-1)[0];
          let entry_uri = path+'/'+name+'/stats';
          let entry_url ="https://localhost" +entry_uri;
  
          let vipStats = { 
            clientside_curConns: resp.body.entries[entry_url].nestedStats.entries["clientside.curConns"].value,
            clientside_maxConns: resp.body.entries[entry_url].nestedStats.entries["clientside.maxConns"].value,
            clientside_bitsIn: resp.body.entries[entry_url].nestedStats.entries["clientside.bitsIn"].value,
            clientside_bitsOut: resp.body.entries[entry_url].nestedStats.entries["clientside.bitsOut"].value,
            clientside_pktsIn: resp.body.entries[entry_url].nestedStats.entries["clientside.pktsIn"].value,
            clientside_pktsOut: resp.body.entries[entry_url].nestedStats.entries["clientside.pktsOut"].value  
          };
  
          resolve(vipStats);
  
        })
        .catch((error) => {
          logger.info('[BigStats] - Error: ' +error);
          reject(error);
        });
      });
    });
  
    var getPoolStats = ((resource) => {
      return new Promise((resolve,reject) => {
  
        var that = this;
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - ***************IN getPoolStats with resource_list: ' +JSON.stringify(resource)); }
  
        var path = ""; 
        var PREFIX = "https://localhost";
  
        if (resource.poolReference.link.indexOf(PREFIX) === 0) {
          // PREFIX is exactly at the beginning
          path = resource.poolReference.link.slice(PREFIX.length).split("?").shift();
        }
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Sliced Path: '+path); }
        var uri = path+'/stats';
        if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Stats URI: '+uri); }
  
        var url = that.restHelper.makeRestnodedUri(uri);
        var restOp = that.createRestOperation(url);
      
        that.restRequestSender.sendGet(restOp)
        .then((resp) => {
  
          let name = path.split("/").slice(-1)[0];
          let entry_uri = path+'/'+name+'/stats';
          let entry_url ="https://localhost" +entry_uri;
  
          let poolStats = { 
            serverside_curConns: resp.body.entries[entry_url].nestedStats.entries["serverside.curConns"].value,
            serverside_maxConns: resp.body.entries[entry_url].nestedStats.entries["serverside.maxConns"].value,
            serverside_bitsIn: resp.body.entries[entry_url].nestedStats.entries["serverside.bitsIn"].value,
            serverside_bitsOut: resp.body.entries[entry_url].nestedStats.entries["serverside.bitsOut"].value,
            serverside_pktsIn: resp.body.entries[entry_url].nestedStats.entries["serverside.pktsIn"].value,
            serverside_pktsOut: resp.body.entries[entry_url].nestedStats.entries["serverside.pktsOut"].value  
          };
  
          resolve(poolStats);
  
        })
        .catch((error) => {
          logger.info('[BigStats - Error] pool_stats error: '+error);
        });
      });
    });
  
    this.getSettings()
    .then((config) => {
  
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - config.destination: ' +JSON.stringify(config.destination)); }
      return getResourceList();
  
    })    
    .then((resource_list) => {
  
      return parseResources(resource_list);
  
    })
    .then((stats) => {
  
      if (DEBUG === true) { logger.info('[BigStats - DEBUG] - Pushing stats: ' +JSON.stringify(stats, '', '\t')); }
      that.statsExporter(stats);
  
    })
    .catch((error) => {
  
      logger.info('Promise Chain Error: ' +error);
  
    });
  
};

module.exports = BigStats;