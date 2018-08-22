# Lab environment for BigStats destinations

What is BigStats? Learn more here: https://npearce.github.io

For your convenience, so that you can test BigStats in your own lab enviroments against destinations like **StatsD** and **Apache Kafka**, here are the instructions used to create the stats destinations used in the BigStats development lab.

---

## BigStats -> StatsD -> GraphiteDB -> Grafana

The development lab environment for the Graphite/Grafana destinations was created on Docker (on AWS):

Requirements:

* 1 docker community-edition host on a 't2.micro' instance
* 2 docker containers

Using the following instructions:

https://gist.github.com/npearce/d38dc53c244196d73d93735f2645f47a

---

## BigStats -> Apache Kafka

The development lab environment for the Apache Kafka Broker destination was created on Docker (on AWS):

Requirements:

* 1 docker community-edition host on a 't2.medium' instance
* docker-compose
* 2 docker containers, generated using docker-compose

Using the following instructions:

https://gist.github.com/npearce/8a188e9834f64743bd173df2b53df9be
