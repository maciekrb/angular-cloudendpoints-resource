(function(){ 
  'use strict';
  angular.module('endpoints.resource', [])
    .provider('endpointsResource', function(){
      
      // Create a special object for config fields that are required and missing.
      // If any config items still contain it when endpoint resource is used, 
      // raise an error.
      var REQUIRED_AND_MISSING = {};

      // Basic endpoint config params
      var config = {
        hostname: REQUIRED_AND_MISSING,
        endpoints_api_name: REQUIRED_AND_MISSING,
        prefix: '/_ah/api',
        endpoints_api_version: 'v1'
      };

      // Method to call from angular.module.config() overriding config options
      this.extendConfig = function(configExt){
        config = angular.extend(config, configExt);
      };
      
      // Angular provide API
      this.$get = ['$q', '$http', function($q, $http){

        // Track non configured values
        var requiredAndMissing = [];
        angular.forEach(config, function(value, key){
          if(value === REQUIRED_AND_MISSING){
            requiredAndMissing.push(key);
          }
        });
        
        if(requiredAndMissing.length){
          throw new Error("endpoint.resource not fully configured. Please review the following " +
              "options using EndpointResourceProvider.extendConfig: " + requiredAndMissing.join(", "));
        }

        function EndpointsResourceFactory(resource_path, Token) {

          var endpoint = config.hostname + config.prefix + '/' + config.endpoints_api_name 
                + '/' + config.endpoints_api_version + '/' + resource_path;
          var extra_headers = Token !== undefined ? Token.getAsHeaderConfig() : {}; 
          console.log("Endoponts headers", extra_headers);
          var defaultParams = {};
          /**
          if (RENZU_CONFIG.apiKey) {
            defaultParams.apiKey = MONGOLAB_CONFIG.apiKey;
          }
          **/

          var thenFactoryMethod = function (httpPromise, successcb, errorcb, isArray) {
            var scb = successcb || angular.noop;
            var ecb = errorcb || angular.noop;

            return httpPromise.then(function (response) {
              var result;
              if (isArray) {
                result = [];
                for (var i = 0; i < response.data.length; i++) {
                  result.push(new Resource(response.data[i]));
                }
              } else {
                //MongoLab has rather peculiar way of reporting not-found items, I would expect 404 HTTP response status...
                console.log("Response from endpoint, empty debug ??", response);
                if (response.data === " null "){
                  return $q.reject({
                    code:'resource.notfound',
                    collection:collectionName
                  });
                } else {
                  result = new Resource(response.data);
                }
              }
              scb(result, response.status, response.headers, response.config);
              return result;
            }, function (response) {
              ecb(response.error, response.status, response.headers, response.config);
              return response.error;
            });
          };

          var Resource = function (data) {
            angular.extend(this, data);
          };

          Resource.all = function (cb, errorcb) {
            return Resource.query({}, cb, errorcb);
          };

          Resource.query = function (queryJson, successcb, errorcb) {
            var params = angular.isObject(queryJson) ? {q:JSON.stringify(queryJson)} : {};
            var httpPromise = $http.get(endpoint, {
              headers: extra_headers,
              params: angular.extend({}, defaultParams, queryJson),
            });
            return thenFactoryMethod(httpPromise, successcb, errorcb, false);
          };

          Resource.getById = function (id, successcb, errorcb) {
            var httpPromise = $http.get(endpoint + '/' + id, {
              headers: extra_headers,
              params: defaultParams
            });
            return thenFactoryMethod(httpPromise, successcb, errorcb);
          };

          Resource.getByIds = function (ids, successcb, errorcb) {
            var qin = [];
            angular.forEach(ids, function (id) {
              qin.push({$oid: id});
            });
            return Resource.query({_id:{$in:qin}}, successcb, errorcb);
          };

          //instance methods

          Resource.prototype.$id = function () {
            if (this._id && this._id.$oid) {
              return this._id.$oid;
            }
          };

          Resource.prototype.$save = function (successcb, errorcb) {
            var httpPromise = $http.post(endpoint, this, {
              headers: extra_headers,
              params: defaultParams
            });
            return thenFactoryMethod(httpPromise, successcb, errorcb);
          };

          Resource.prototype.$update = function (successcb, errorcb) {
            var httpPromise = $http.put(endpoint + "/" + this.$id(), angular.extend({}, this, {_id:undefined}), {
              headers: extra_headers,
              params:defaultParams
            });
            return thenFactoryMethod(httpPromise, successcb, errorcb);
          };

          Resource.prototype.$remove = function (successcb, errorcb) {
            var httpPromise = $http['delete'](endpoint + "/" + this.$id(), {
              headers: extra_headers,
              params:defaultParams
            });
            return thenFactoryMethod(httpPromise, successcb, errorcb);
          };

          Resource.prototype.$saveOrUpdate = function (savecb, updatecb, errorSavecb, errorUpdatecb) {
            if (this.$id()) {
              return this.$update(updatecb, errorUpdatecb);
            } else {
              return this.$save(savecb, errorSavecb);
            }
          };

          return Resource;
        };

        return EndpointsResourceFactory;

      }];
    });
})();
