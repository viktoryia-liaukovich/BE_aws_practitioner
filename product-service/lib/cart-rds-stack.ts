import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class CartRdsStack extends cdk.Stack {
  public readonly database: rds.DatabaseInstance;
  public readonly vpc: ec2.Vpc;
  public readonly dbSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC for RDS
    this.vpc = new ec2.Vpc(this, 'CartVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Create security group for RDS
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'CartDbSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Cart RDS instance',
      allowAllOutbound: true,
    });

    // Allow connections from Lambda (we'll add Lambda security group later)
    this.dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from VPC'
    );

    // Create RDS PostgreSQL instance
    this.database = new rds.DatabaseInstance(this, 'CartDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [this.dbSecurityGroup],
      databaseName: 'cartdb',
      credentials: rds.Credentials.fromGeneratedSecret('postgres', {
        secretName: 'cart-db-credentials',
      }),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      multiAz: false,
      publiclyAccessible: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev/test only
      deletionProtection: false,
    });

    // Output database endpoint
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.dbInstanceEndpointAddress,
      description: 'RDS Database Endpoint',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.database.secret?.secretArn || '',
      description: 'Database credentials secret ARN',
    });
  }
}
